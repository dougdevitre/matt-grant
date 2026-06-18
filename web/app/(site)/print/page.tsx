import type { Metadata } from "next";
import { PrintStudio } from "@/components/PrintStudio";

export const metadata: Metadata = {
  title: "Print at Walgreens",
  description: "Print Matt Grant campaign materials at your local Walgreens — pick a design, a size, and a store.",
};

export default function PrintPage() {
  return (
    <section className="container-page py-16 sm:py-24">
      <p className="eyebrow text-brick">Supporter toolkit</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Print it at your Walgreens.</h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        Pick a design, choose a size, and pick it up printed at a Walgreens near you — usually the
        same day. No design software, no waiting on the mail.
      </p>
      <PrintStudio />
    </section>
  );
}
