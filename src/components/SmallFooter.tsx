import React from 'react';

export default function SmallFooter() {
    return (
        <footer className="w-full mt-auto py-6 border-t border-[#eadcc5]/50 bg-[#FAFAFA]/40 backdrop-blur-sm shrink-0">
            <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-[11px] font-bold text-gray-500 tracking-widest uppercase">
                    FFCS Planner • © {new Date().getFullYear()}
                </p>
                <p className="text-[11px] font-bold text-gray-500 tracking-widest uppercase flex items-center gap-1.5 select-none">
                    Built with <span className="text-red-500 animate-pulse">❤️</span> by{' '}
                    <a 
                        href="https://microsoftinnovations.club" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[#3B5BDB] hover:underline"
                    >
                        Microsoft Innovations Club
                    </a>
                </p>
            </div>
        </footer>
    );
}
