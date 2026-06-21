import React from 'react';

export default function SmallFooter() {
    return (
        <footer className="w-full mt-auto py-10 flex justify-center px-4 sm:px-6 shrink-0 select-none">
            <div className="w-full max-w-6xl bg-white/70 backdrop-blur-md border border-[#eadcc5]/80 rounded-3xl p-5 sm:p-6 shadow-[0_12px_40px_rgba(74,54,30,0.03)] flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Left side: Status Indicator & Title */}
                <div className="flex items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[11px] font-black text-gray-700 tracking-widest uppercase">
                        FFCS Planner • © {new Date().getFullYear()}
                    </span>
                </div>

                {/* Right side: Credits Link */}
                <div className="text-[11px] font-black text-gray-500 tracking-widest uppercase flex flex-wrap items-center justify-center gap-2">
                    <span>Designed & Built with</span>
                    <span className="text-red-500 animate-pulse text-sm">❤️</span>
                    <span>by</span>
                    <a 
                        href="https://microsoftinnovations.club" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center px-3.5 py-1.5 bg-[#3B5BDB]/8 hover:bg-[#3B5BDB]/15 text-[#3B5BDB] rounded-xl font-extrabold transition-all border border-[#3B5BDB]/10 hover:border-[#3B5BDB]/25 shadow-sm active:scale-95 duration-200"
                    >
                        Microsoft Innovations Club
                    </a>
                </div>
            </div>
        </footer>
    );
}
