import { Hero } from "@/components/home/hero";
import { LogoMarquee } from "@/components/home/logo-marquee";
import { About } from "@/components/home/about";
import { FeaturedCampaigns } from "@/components/home/featured-campaigns";
import { Features } from "@/components/home/features";
import { Testimonials } from "@/components/home/testimonials";
import { Stats } from "@/components/home/stats";
import { Pricing } from "@/components/home/pricing";
import { CTA } from "@/components/home/cta";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <LogoMarquee />
      <About />
      <FeaturedCampaigns />
      <Features />
      <Testimonials />
      <Stats />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}


