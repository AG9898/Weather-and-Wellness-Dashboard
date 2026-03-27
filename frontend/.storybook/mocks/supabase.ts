export const supabase = {
  auth: {
    async getSession() {
      return {
        data: { session: null },
        error: null,
      };
    },
    async signInWithPassword() {
      return {
        data: { session: null, user: null },
        error: null,
      };
    },
    async signOut() {
      return { error: null };
    },
    async updateUser() {
      return {
        data: { user: null },
        error: null,
      };
    },
    onAuthStateChange() {
      return {
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      };
    },
  },
} as const;
