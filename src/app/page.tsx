import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { ScrollProgress } from "@/components/scroll-progress";
import { PageBackground } from "@/components/background/page-background";
import { StackMarquee } from "@/components/stack-marquee";
import { Capabilities } from "@/components/capabilities";
import { AutomationCanvas } from "@/components/automation-canvas";
import { Process } from "@/components/process";
import { Cta } from "@/components/cta";
import { Team } from "@/components/team";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <PageBackground />
      <ScrollProgress />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <StackMarquee />
        <Capabilities />
        <AutomationCanvas />
        <Process />
        <Cta />
        <Team />
      </main>
      <Footer />
    </>
  );
}
