from uuid import UUID, uuid4
from pydantic import BaseModel


class LabMember(BaseModel):
    id: UUID
    email: str


def get_current_lab_member() -> LabMember:  # pragma: no cover
    # Stub dependency for Phase 1 development (T06).
    # TODO(T18): Replace with Supabase JWT validation and return claims.
    return LabMember(id=uuid4(), email="ra@example.com")


__all__ = ["LabMember", "get_current_lab_member"]
