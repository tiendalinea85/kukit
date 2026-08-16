from pydantic import BaseModel, Field


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
