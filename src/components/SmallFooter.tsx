import React from 'react';

export default function SmallFooter() {
    return (
        <footer className="w-full mt-auto py-5 flex justify-center px-4 shrink-0 select-none">
            <div className="w-full max-w-6xl bg-white/70 backdrop-blur-md border border-[#eadcc5]/70 rounded-2xl py-3 px-5 sm:py-3.5 sm:px-6 shadow-[0_8px_30px_rgba(74,54,30,0.025)] flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Left side: Static Status Indicator & Title */}
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[11px] font-black text-gray-700 tracking-widest uppercase">
                        FFCS Planner • © {new Date().getFullYear()}
                    </span>
                </div>

                {/* Right side: Static Credits Link */}
                <div className="text-[11px] font-black text-gray-500 tracking-widest uppercase flex flex-wrap items-center justify-center gap-2">
                    <span>Designed & Built with</span>
                    <span className="text-red-500 text-sm">❤️</span>
                    <span>by</span>
                    <a 
                        href="https://microsoftinnovations.club" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center px-3 py-1 bg-[#3B5BDB]/8 hover:bg-[#3B5BDB]/15 text-[#3B5BDB] rounded-xl font-extrabold transition-all active:scale-95 duration-200"
                    >
                        Microsoft Innovations Club
                    </a>
                </div>
            </div>
        </footer>
    );
}
