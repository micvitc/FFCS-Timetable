"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import TimetableIllustration from "./TImeTableIllustration";
import LoginModal from "../loginPopup";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Section1() {
  const [open, setOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session && showLogin) {
      const timer = window.setTimeout(() => {
        setShowLogin(false);
        setOpen(true);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [session, showLogin]);

  function handleLogin() {
    if (session) {
      setOpen(true);
    } else {
      setShowLogin(true);
    }
  }

  return (
    <>
      <div className="w-full min-h-screen flex justify-center items-center bg-[#FFF8E7]">
        <div className="w-[92%] max-w-[1200px] bg-white rounded-4xl shadow-[0_8px_30px_rgba(0,0,0,0.03)]  min-h-[680px]      flex flex-col relative">
          {/* NAVBAR */}
          <nav className="w-full  h-[102px]   rounded-t-[28px] shadow-[0px_6px_30.1px_rgba(186,185,185,0.25)] relative">
            <span className="left-20 top-7 text-[30px] font-bold text-black tracking-widest uppercase absolute">
              FFCS
            </span>

            <button
              onClick={handleLogin}
              className="right-20 top-7 absolute w-[120px] h-[45px] rounded-[8px] border-[3px] border-[#93C5FD] bg-white px-10 py-2.5 text-[14px] font-semibold text-black hover:bg-gray-50 transition-colors shadow-sm"
            >
              {session ? session.user?.name?.split(" ")[0] : "Login"}
            </button>
          </nav>
          {showLogin && (
            <LoginModal onClose={() => setShowLogin(false)} />
          )}

          {/* HERO */}
          <div className="flex flex-col lg:flex-row items-center justify-around flex-1 w-full gap-8 mt-4 px-10">
            {/* Left Content */}
            <div className=" flex-1 flex flex-col h-80 justify-center items-center mt-[-40px] relative">
              <h1 className="text-[72px] xl:text-[86px]  font-black text-black leading-[0.95] tracking-tighter mb-5 top-0 absolute">
                Build Your
                <br />
                Timetable
              </h1>
              <p className="max-w-[360px] text-[15px] text-gray-800 font-medium leading-[1.6] mb-8 absolute top-43  ">
                Lorem Ipsum Dolor Sit Amet, Consectetur
                <br />
                Adipiscing Elit, Sed Do Eiusmod Tempor
              </p>
              <div className="flex gap-4 absolute top-60">
                <button
                  onClick={handleLogin}
                  className="rounded-[8px] w-[180px] h-[50px]  py-3.5 text-[14px] font-bold text-black border-[1.5px] border-[#A0C4FF] bg-[#A0C4FF] hover:bg-[#8ab2f2] transition-colors shadow-sm"
                >
                  Get Started
                </button>
                {open && (
                  <div className="fixed  inset-0 flex items-center justify-center bg-black/30 z-50">
                    {/* Modal */}
                    <div className="flex items-center justify-center w-[949px] h-[511px] bg-[#FFFCEE] rounded-[20px] shadow-xl p-8 relative">
                      {/* Close Button */}
                      <div className="relative bg-[#FAFAFA] w-[900px] h-[459px] flex flex-col items-center rounded-[20px] p-10 shadow-[4px_4px_4px_rgba(191,191,191,0.25)]">
                        {/* Close Button */}
                        <button
                          onClick={() => setOpen(false)}
                          className="absolute top-6 right-6 text-gray-500 hover:text-black text-[28px]"
                        >
                          ✕
                        </button>

                        {/* Title */}
                        <h2 className="text-[32px] font-semibold text-center mb-2 absolute top-[50px]">
                          Welcome back, {session?.user?.name}!
                        </h2>

                        {/* Divider */}
                        <div className="w-[700px] h-[1px] bg-gray-300 mb-4 absolute top-[90px]"></div>

                        {/* Subtitle */}
                        <p className=" text-center text-[20px] mb-12 absolute top-[110px]">
                          Choose what you&apos;d like to do next
                        </p>

                        {/* Options */}
                        <div className="flex gap-14 absolute top-[180px]">
                          {/* Create new */}
                          <button
                            className="flex flex-col items-center justify-center bg-[#E9F3E8] border-[5px] border-[#D4F4E6] rounded-[16px] p-6 w-[290px] h-[200px] shadow hover:bg-green-200 transition"
                            onClick={() => { setOpen(false); router.push('/preferences'); }}
                          >
                            <Image
                              src="/create_new.png"
                              alt="create"
                              width={167}
                              height={101}
                            />

                            <p className=" font-medium text-center">
                              Create a new one
                            </p>
                          </button>

                          {/* View saved */}
                          <button
                            className="flex flex-col items-center justify-center bg-[#E9D5FF] border-[#F2D8FE] border-[5px] rounded-[16px] p-6 w-[290px] h-[200px] shadow hover:bg-purple-300 transition"
                            onClick={() => { setOpen(false); router.push("/saved"); }}
                          >
                            <Image
                              src="/savedTimetable.png"
                              alt="saved"
                              width={167}
                              height={101}
                            />

                            <p className="mt-4 font-medium text-center">
                              View saved timetables
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <button className="rounded-[8px] w-[180px] h-[50px]  border-[1.5px] border-[#A0C4FF] px-8 py-3.5 text-[14px] font-bold text-black bg-white hover:bg-blue-50 transition-colors shadow-sm">
                  Slot View
                </button>
              </div>
            </div>

            {/* Right Content */}
            <div className="flex-1 flex justify-center items-center shrink-0 pr-10 pl-4">
              <TimetableIllustration />
            </div>
          </div>
        </div>

        {/* ===== SPACER ===== */}
        <div className="h-[80px]" />
      </div>
    </>
  );
}
