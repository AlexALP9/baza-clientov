import { getUserId } from './session';
// Kept as an adapter so the existing clients API retains its identity shape.
// Platform identity headers are deliberately ignored.
export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};
export async function getChatGPTUser(request: Request): Promise<ChatGPTUser | null> {
  const userId = await getUserId(request);
  return userId ? { userId, displayName: userId, email: '', fullName: null } : null;
}
