from pydantic import BaseModel
from typing import Literal, Optional

UserTypeLiteral = Literal['free', 'premium', 'admin']


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    picture_url: Optional[str] = None
    user_type: UserTypeLiteral = 'free'

    model_config = {'from_attributes': True}


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str