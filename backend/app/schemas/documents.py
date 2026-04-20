from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    file_type: str
    storage_url: str
    excerpt: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {'from_attributes': True}
