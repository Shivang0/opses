import '../components/landing/landing.css'
import LandingNav from '../components/landing/LandingNav'
import Hero from '../components/landing/Hero'
import ProblemSection from '../components/landing/ProblemSection'
import PipelineSection from '../components/landing/PipelineSection'
import SovereigntySection from '../components/landing/SovereigntySection'
import ComplianceSection from '../components/landing/ComplianceSection'
import FinalCta from '../components/landing/FinalCta'
import SiteFooter from '../components/landing/SiteFooter'

/**
 * OPSES landing - cinematic editorial security. A sticky slim nav over a
 * full-viewport hero, then editorial bands: the shadow-AI problem, the in-house
 * pipeline, the sovereignty beat, compliance frameworks, and a closing CTA.
 */
export default function Landing() {
  return (
    <div id="top" className="opses-emerald min-h-screen bg-ink text-paper">
      <LandingNav />
      <main>
        <Hero />
        <ProblemSection />
        <PipelineSection />
        <SovereigntySection />
        <ComplianceSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
