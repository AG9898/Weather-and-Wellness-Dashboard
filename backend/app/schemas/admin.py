from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AdminUserRole = Literal["admin", "ra"]
SessionClassification = Literal[
    "complete",
    "partial",
    "empty_active",
    "empty_stale",
    "voided",
]
StudySlug = Literal["weather", "misokinesia", "poffenberger"]


class ImportRowIssue(BaseModel):
    row: int
    field: str | None = None
    message: str


class ImportPreviewResponse(BaseModel):
    file_type: str
    rows_total: int
    participants_create: int
    participants_update: int
    sessions_create: int
    sessions_update: int
    errors: list[ImportRowIssue]
    warnings: list[ImportRowIssue]


class ImportCommitResponse(BaseModel):
    rows_total: int
    participants_created: int
    participants_updated: int
    sessions_created: int
    sessions_updated: int


class LegacyWeatherBackfillResponse(BaseModel):
    days_inserted: int
    days_updated: int
    days_skipped: int


class AdminFlaggedSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    study: StudySlug
    lab: str
    participant_number: int
    session_id: UUID
    run_id: UUID | None = None
    created_at: datetime
    activated_at: datetime | None = None
    completed_at: datetime | None = None
    classification: SessionClassification
    demographics_missing: bool


class AdminVoidSessionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reason: str = Field(min_length=1, max_length=500)


class AdminSessionVoidStateResponse(BaseModel):
    session_id: UUID
    voided_at: datetime | None = None
    void_reason: str | None = None


class AdminSessionDeleteResponse(BaseModel):
    session_id: UUID
    deleted: Literal[True] = True


class AdminUserResponse(BaseModel):
    id: str
    email: str
    role: AdminUserRole | str
    lab_name: str
    is_banned: bool
    created_at: str
    last_sign_in_at: str | None = None


class AdminInvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invitation_id: UUID
    email: str
    role: AdminUserRole | str
    lab_name: str
    status: str
    expires_at: datetime
    accepted_at: datetime | None = None
    revoked_at: datetime | None = None
    revoked_by_lab_member_id: UUID | None = None
    created_by_lab_member_id: UUID
    supabase_user_id: UUID | None = None
    last_sent_at: datetime | None = None
    send_count: int
    provider_message_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AdminUsersResponse(BaseModel):
    users: list[AdminUserResponse]
    invitations: list[AdminInvitationResponse]


class CreateUserInvitationRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: AdminUserRole
    lab_name: str = Field(min_length=1, max_length=64)


class UpdateAdminUserRequest(BaseModel):
    role: AdminUserRole
    lab_name: str = Field(min_length=1, max_length=64)


class AcceptInvitationRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    password: str = Field(min_length=8, max_length=256)


class AcceptInvitationResponse(BaseModel):
    email: str
    role: AdminUserRole | str
    lab_name: str
    supabase_user_id: str
    status: Literal["accepted"] = "accepted"


__all__ = [
    "AdminUserRole",
    "ImportRowIssue",
    "ImportPreviewResponse",
    "ImportCommitResponse",
    "LegacyWeatherBackfillResponse",
    "AdminFlaggedSessionResponse",
    "AdminVoidSessionRequest",
    "AdminSessionVoidStateResponse",
    "AdminSessionDeleteResponse",
    "AdminUserResponse",
    "AdminInvitationResponse",
    "AdminUsersResponse",
    "CreateUserInvitationRequest",
    "UpdateAdminUserRequest",
    "AcceptInvitationRequest",
    "AcceptInvitationResponse",
]
