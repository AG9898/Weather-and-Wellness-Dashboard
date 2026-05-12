import { ApiError } from "@/lib/api";

export type InviteActivationState =
  | "loading"
  | "ready"
  | "success"
  | "missing"
  | "invalid"
  | "expired"
  | "unavailable"
  | "delivery_error"
  | "server_error";

export interface InviteActivationCopy {
  title: string;
  body: string;
}

export function getInviteActivationErrorState(error: unknown): InviteActivationState {
  if (error instanceof ApiError) {
    if (error.status === 404 || error.status === 422) {
      return "invalid";
    }
    if (error.status === 410) {
      return "expired";
    }
    if (error.status === 409) {
      return "unavailable";
    }
    if (error.status === 502) {
      return "delivery_error";
    }
    return "server_error";
  }
  return "server_error";
}

export function getInviteActivationCopy(
  state: InviteActivationState
): InviteActivationCopy {
  switch (state) {
    case "loading":
      return {
        title: "Checking invite",
        body: "Verifying the invitation link.",
      };
    case "ready":
      return {
        title: "Set your password",
        body: "Choose a password to activate your account.",
      };
    case "success":
      return {
        title: "Account activated",
        body: "Your account is ready. Sign in with your email and new password.",
      };
    case "missing":
      return {
        title: "Invite link missing",
        body: "Open the full invite link from your email, or ask your lab administrator to send a new invite.",
      };
    case "expired":
      return {
        title: "Invite expired",
        body: "This invite has expired. Ask your lab administrator to send a new invite.",
      };
    case "unavailable":
      return {
        title: "Invite unavailable",
        body: "This invite has already been accepted or has been revoked. Ask your lab administrator for a current invite.",
      };
    case "delivery_error":
      return {
        title: "Activation unavailable",
        body: "The invite was valid, but account activation could not be completed. Ask your lab administrator to try again.",
      };
    case "invalid":
    case "server_error":
      return {
        title: state === "invalid" ? "Invite invalid" : "Activation failed",
        body:
          state === "invalid"
            ? "This invite link is invalid. Ask your lab administrator to send a new invite."
            : "Account activation could not be completed. Please try again or ask your lab administrator for help.",
      };
  }
}
