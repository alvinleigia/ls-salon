export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!auth|api|_next|favicon.ico).*)"],
};
