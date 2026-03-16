'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    question: "What does Askelad do for a solo founder day to day?",
    answer:
      "It acts like a small AI operating team across product, finance, and marketing. Instead of isolated answers, it helps you move work forward with shared context and clearer next actions.",
  },
  {
    question: "Why not just use one general-purpose AI assistant?",
    answer:
      "A single assistant can answer prompts, but it usually does not keep functional discipline. Askelad is structured by role and uses a cofounder layer to keep recommendations aligned across the business.",
  },
  {
    question: "Will the product ask for missing context before making decisions?",
    answer:
      "Yes. Clarification-first behavior is a core part of the product direction. If critical numbers, files, or assumptions are missing, it should ask instead of guessing.",
  },
  {
    question: "Who is the product best suited for right now?",
    answer:
      "The clearest fit is solo founders, indie hackers, and early-stage builders who need structured business support before they can hire a full team.",
  },
  {
    question: "Does this replace advisors or future hires?",
    answer:
      "No. It is better positioned as leverage and structure. It helps you think, prioritize, and execute faster so you can make better use of real advisors and hires when you bring them in.",
  },
];

export default function FaqSection() {
  return (
    <section id="faqs" className="relative left-1/2 w-screen -translate-x-1/2 scroll-mt-36 bg-background py-18 sm:py-22">
      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-mono text-[clamp(1.9rem,2.8vw,2.7rem)] font-bold tracking-[-0.04em] text-foreground md:whitespace-nowrap">
            FAQs
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            The fundamentals a founder would want to understand before trusting the product.
          </p>
        </div>

        <div className="mt-12">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger className="text-base text-foreground sm:text-lg">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="max-w-3xl text-sm leading-7 sm:text-base">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
