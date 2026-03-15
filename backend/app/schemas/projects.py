from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field



class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    industry: Optional[str] = Field(None, max_length=100)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    industry: Optional[str] = Field(None, max_length=100)


class ProjectResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str]
    industry: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {'from_attributes': True}