/** Provider-neutral authentication boundary used by UI and persistence. */
export interface AuthSession {
  user: { id: string; email?: string | null };
  accessToken: string;
}

export interface PasswordAuthProvider {
  readonly configured: boolean;
  getSession(): Promise<AuthSession | null>;
  signIn(credentials: { email: string; password: string }): Promise<AuthSession | null>;
  signUp(credentials: { email: string; password: string }): Promise<AuthSession | null>;
  signOut(): Promise<void>;
  subscribe(listener: (session: AuthSession | null) => void): () => void;
}
