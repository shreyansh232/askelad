import Landing from "@/components/Landing";
import FaqSection from "@/components/FaqSection";
import Footer from "@/components/Footer";
import HowItWorks from "@/components/HowItWorks";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Askelad | Your AI Co-Founding Team",
  description: "Stop building in isolation. Askelad gives solo founders an elite AI co-founding team to handle strategy, finance, and marketing.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Landing />

      <div>
        <div className="relative left-1/2 h-px w-screen -translate-x-1/2 bg-white/14" />
        <div>
          <HowItWorks />
        </div>
      </div>
        <div className="relative left-1/2 h-px w-screen -translate-x-1/2 bg-white/14" />
      <FaqSection />
      <Footer />
    </div>
  );
}
