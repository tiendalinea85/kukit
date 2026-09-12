from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

ROLE_PATTERN = "^(OWNER|ADMIN|USER|READ_ONLY)$"


class ProfileData(BaseModel):
    email: Optional[str] = None
    full_name: str = ""
    created_at: Optional[datetime] = None


class ProfileResponse(BaseModel):
    id: str
    email: Optional[str] = None
    profile: Optional[ProfileData] = None


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)


class RoleResponse(BaseModel):
    workspace_id: str
    role: str


class MemberRoleUpdate(BaseModel):
    role: str = Field(pattern=ROLE_PATTERN)


class MembersResponse(BaseModel):
    workspace_id: str
    user_id: str
    role: str
    joined_at: Optional[datetime] = None


class AuditEventResponse(BaseModel):
    id: int
    action: str
    entity_type: Optional[str] = ""
    entity_id: Optional[str] = ""
    metadata: Optional[dict] = None
    created_at: datetime


class ChangeItem(BaseModel):
    entity_type: str
    entity_id: str
    operation: str = Field(pattern="^(INSERT|UPDATE|DELETE)$")
    payload: dict


class OutboxEntry(BaseModel):
    id: int
    entity_type: str
    entity_id: str
    operation: str = Field(pattern="^(INSERT|UPDATE|DELETE)$")
    payload: str


class PushRequest(BaseModel):
    changes: list[OutboxEntry]


class PushResponse(BaseModel):
    applied_ids: list[int]


class PullRequest(BaseModel):
    cursors: dict[str, str] = {}


class PullResponse(BaseModel):
    changes: list[ChangeItem]
    server_time: str
