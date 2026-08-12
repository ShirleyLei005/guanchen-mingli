import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./site-chrome";

export function PolicyShell({ eyebrow, title, intro, children }: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="inner-page">
      <SiteHeader />
      <section className="policy-hero">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{intro}</span>
      </section>
      <section className="policy-document">{children}</section>
      <SiteFooter />
    </main>
  );
}
