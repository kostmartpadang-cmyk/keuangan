import { redirect } from "next/navigation";

// Proxy mengarahkan pengguna yang belum login ke /login; selebihnya ke dashboard.
export default function Home() {
  redirect("/dashboard");
}
