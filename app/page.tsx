import { redirect } from "next/navigation";

/** MVP 01: la plataforma abre directo en el primer personaje. */
export default function Home() {
  redirect("/p/peron");
}
