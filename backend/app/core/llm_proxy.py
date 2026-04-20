import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from litellm import acompletion

from app.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class ToolFunctionCall:
    name: str = ''
    arguments: str = ''


@dataclass
class ToolCall:
    id: str = ''
    type: str = 'function'
    function: ToolFunctionCall = field(default_factory=ToolFunctionCall)


@dataclass
class ChatMessage:
    role: str = 'assistant'
    content: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)

    def model_dump(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            'role': self.role,
            'content': self.content,
        }
        if self.tool_calls:
            payload['tool_calls'] = [
                {
                    'id': tool_call.id,
                    'type': tool_call.type,
                    'function': {
                        'name': tool_call.function.name,
                        'arguments': tool_call.function.arguments,
                    },
                }
                for tool_call in self.tool_calls
            ]
        return payload


class LLMProxy:
    def _get_attr(self, value: Any, key: str, default: Any = None) -> Any:
        if value is None:
            return default
        if isinstance(value, dict):
            return value.get(key, default)
        return getattr(value, key, default)

    def _normalize_tool_calls(self, tool_calls: Any) -> list[ToolCall]:
        normalized: list[ToolCall] = []
        if not tool_calls:
            return normalized

        for tool_call in tool_calls:
            function = self._get_attr(tool_call, 'function')
            normalized.append(
                ToolCall(
                    id=self._get_attr(tool_call, 'id', ''),
                    type=self._get_attr(tool_call, 'type', 'function'),
                    function=ToolFunctionCall(
                        name=self._get_attr(function, 'name', ''),
                        arguments=self._get_attr(function, 'arguments', ''),
                    ),
                )
            )
        return normalized

    def _message_from_provider(self, message: Any) -> ChatMessage:
        return ChatMessage(
            role=self._get_attr(message, 'role', 'assistant'),
            content=self._get_attr(message, 'content'),
            tool_calls=self._normalize_tool_calls(self._get_attr(message, 'tool_calls')),
        )

    async def _collect_stream(
        self,
        stream: Any,
        on_content_delta: Callable[[str], Awaitable[None]] | None = None,
    ) -> ChatMessage:
        content_parts: list[str] = []
        tool_calls: dict[int, ToolCall] = {}
        role = 'assistant'

        async for chunk in stream:
            choices = self._get_attr(chunk, 'choices', [])
            if not choices:
                continue

            delta = self._get_attr(choices[0], 'delta')
            if not delta:
                continue

            role = self._get_attr(delta, 'role', role) or role
            content_delta = self._get_attr(delta, 'content')
            if content_delta:
                content_parts.append(content_delta)
                if on_content_delta:
                    await on_content_delta(content_delta)

            for position, tool_call_delta in enumerate(self._get_attr(delta, 'tool_calls', []) or []):
                index = self._get_attr(tool_call_delta, 'index', position)
                current = tool_calls.setdefault(index, ToolCall())
                current.id = self._get_attr(tool_call_delta, 'id', current.id)
                current.type = self._get_attr(tool_call_delta, 'type', current.type)

                function_delta = self._get_attr(tool_call_delta, 'function')
                if function_delta:
                    current.function.name += self._get_attr(function_delta, 'name', '')
                    current.function.arguments += self._get_attr(function_delta, 'arguments', '')

        return ChatMessage(
            role=role,
            content=''.join(content_parts) or None,
            tool_calls=[tool_calls[index] for index in sorted(tool_calls)],
        )

    @property
    def model_name(self) -> str:
        return settings.llm_model

    @property
    def is_configured(self) -> bool:
        return settings.openai_api_key is not None

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | None = None,
        tool_choice: str = "auto",
        on_content_delta: Callable[[str], Awaitable[None]] | None = None,
    ) -> ChatMessage:
        if not self.is_configured:
            raise RuntimeError("LLM provider is not configured")

        kwargs = {
            "model": settings.llm_model,
            "api_key": settings.openai_api_key.get_secret_value(),
            "temperature": settings.llm_temperature,
            "max_tokens": settings.llm_max_tokens,
            "messages": messages,
        }

        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = tool_choice

        if on_content_delta:
            kwargs['stream'] = True
            stream = await acompletion(**kwargs)
            return await self._collect_stream(stream, on_content_delta=on_content_delta)

        response = await acompletion(**kwargs)
        return self._message_from_provider(response.choices[0].message)

    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        tools: list[dict] | None = None,
    ) -> str | ChatMessage:
        if not self.is_configured:
            raise RuntimeError("LLM provider is not configured")

        kwargs = {
            "model": settings.llm_model,
            "api_key": settings.openai_api_key.get_secret_value(),
            "temperature": settings.llm_temperature,
            "max_tokens": settings.llm_max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = await acompletion(**kwargs)
        message = self._message_from_provider(response.choices[0].message)

        if message.tool_calls:
            # If there are tool calls, we return the message object so the caller can handle it
            return message

        content = message.content if response.choices else None
        if not content:
            logger.warning("LLM response did not include message content")
            return ""
        return content


llm_proxy = LLMProxy()
