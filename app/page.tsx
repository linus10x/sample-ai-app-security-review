import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export default async function Home() {
  redirect((await getAuth()) ? "/products" : "/login");
}
