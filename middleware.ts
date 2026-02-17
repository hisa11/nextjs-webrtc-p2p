// 認証を任意にするため、ミドルウェアを無効化
// export { auth as middleware } from "@/auth"

export const config = {
  matcher: [],  // 空配列で全てのルートを許可
}
