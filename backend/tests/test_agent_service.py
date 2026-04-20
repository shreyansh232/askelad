from app.services.agents import StreamingContentFieldParser, agent_service


def test_parse_response_accepts_code_fenced_json():
    response = agent_service._parse_response(
        '```json\n{"content":"Answer","needs_clarification":true,'
        '"clarification_question":"Need revenue data","requested_docs":["pnl.csv"],'
        '"citations":["deck.pdf"]}\n```'
    )

    assert response.content == 'Answer'
    assert response.needs_clarification is True
    assert response.requested_docs == ['pnl.csv']
    assert response.citations == ['deck.pdf']


def test_parse_response_falls_back_to_plain_text():
    response = agent_service._parse_response('Plain answer without JSON')

    assert response.content == 'Plain answer without JSON'
    assert response.needs_clarification is False
    assert response.requested_docs == []


def test_chunk_text_splits_large_payload():
    chunks = agent_service._chunk_text('abcdefghij', chunk_size=4)

    assert chunks == ['abcd', 'efgh', 'ij']


def test_streaming_content_field_parser_extracts_content_incrementally():
    parser = StreamingContentFieldParser()

    first = parser.feed('{"content":"Hello')
    second = parser.feed(' world","needs_clarification":false}')

    assert first == 'Hello'
    assert second == ' world'


def test_streaming_content_field_parser_decodes_escaped_sequences():
    parser = StreamingContentFieldParser()

    first = parser.feed('{"content":"Line 1\\n')
    second = parser.feed('Line 2\\u0021","needs_clarification":false}')

    assert first == 'Line 1\n'
    assert second == 'Line 2!'
