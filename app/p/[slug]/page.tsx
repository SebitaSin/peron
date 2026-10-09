import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCharacter, isServable, toPublic } from "@/characters";
import Experience from "@/components/Experience";
import { portraitFor } from "@/lib/portrait";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const pack = getCharacter(slug);
  if (!pack || !isServable(slug)) return { title: "Historia Viva" };
  const { og_title, og_description } = pack.profile;
  return {
    title: pack.profile.name,
    description: og_description,
    openGraph: { title: og_title, description: og_description, type: "website", locale: "es_AR", siteName: "Historia Viva" },
    twitter: { card: "summary_large_image", title: og_title, description: og_description },
  };
}

export default async function CharacterPage({ params }: Params) {
  const { slug } = await params;
  const pack = getCharacter(slug);
  if (!pack || !isServable(slug)) notFound();
  return <Experience character={toPublic(pack)} portrait={portraitFor(slug)?.url ?? null} />;
}
