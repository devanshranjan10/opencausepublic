import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 sm:py-16 bg-black/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-8 sm:mb-12">
          <div className="sm:col-span-2 md:col-span-1">
            <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">OpenCause</h3>
            <p className="text-sm sm:text-base text-white/60 leading-relaxed">
              Transparent, escrowed crowdfunding for causes. Built on Web3 for trust and transparency.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 sm:mb-4 text-white text-sm sm:text-base">Product</h4>
            <ul className="space-y-2 sm:space-y-3 text-white/60 text-sm sm:text-base">
              <li>
                <Link href="/campaigns" className="hover:text-white transition-colors">
                  Campaigns
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/auth/signup" className="hover:text-white transition-colors">
                  Start Campaign
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 sm:mb-4 text-white text-sm sm:text-base">Company</h4>
            <ul className="space-y-2 sm:space-y-3 text-white/60 text-sm sm:text-base">
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  About
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 sm:mb-4 text-white text-sm sm:text-base">Legal</h4>
            <ul className="space-y-2 sm:space-y-3 text-white/60 text-sm sm:text-base">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Terms
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-6 sm:pt-8 border-t border-white/10 text-center text-white/40 text-sm sm:text-base">
          <p>&copy; 2024 OpenCause. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

