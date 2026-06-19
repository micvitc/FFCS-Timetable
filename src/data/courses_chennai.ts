const data = [
  {
    "CODE": "BAEEE102",
    "TITLE": "Circuit Theory",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "B1+TB1",
    "FACULTY": "MEENAKSHI J"
  },
  {
    "CODE": "BAEEE201",
    "TITLE": "Digital Electronics",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "F2+TF2",
    "FACULTY": "NITHYA VENKATESAN"
  },
  {
    "CODE": "BEEE211E",
    "TITLE": "VLSI Design",
    "TYPE": "ETH",
    "CREDITS": 2,
    "SLOT": "C2",
    "FACULTY": "VIJAYAPRIYA R"
  },
  {
    "CODE": "BEEE303L",
    "TITLE": "Control Systems",
    "TYPE": "TH",
    "CREDITS": 3,
    "SLOT": "E2+TE2",
    "FACULTY": "MITHU SARKAR"
  },
  {
    "CODE": "BEEE303P",
    "TITLE": "Control Systems Lab",
    "TYPE": "LO",
    "CREDITS": 1,
    "SLOT": "L5+L6",
    "FACULTY": "MITHU SARKAR"
  },
  {
    "CODE": "BEEE309L",
    "TITLE": "Microprocessors and Microcontro",
    "TYPE": "TH",
    "CREDITS": 3,
    "SLOT": "F1+TF1",
    "FACULTY": "PRITAM"
  },
  {
    "CODE": "BEEE309P",
    "TITLE": "Microprocessors and Microcontro",
    "TYPE": "LO",
    "CREDITS": 1,
    "SLOT": "L43+L44",
    "FACULTY": "PRITAM"
  },
  {
    "CODE": "BEEE312L",
    "TITLE": "AC Machines",
    "TYPE": "TH",
    "CREDITS": 2,
    "SLOT": "D2",
    "FACULTY": "JYOTISMITA MISHRA"
  },
  {
    "CODE": "BEEE312P",
    "TITLE": "AC Machines Lab",
    "TYPE": "LO",
    "CREDITS": 1,
    "SLOT": "L55+L56",
    "FACULTY": "JYOTISMITA MISHRA"
  },
  {
    "CODE": "BEEE409L",
    "TITLE": "Robotics and Control",
    "TYPE": "TH",
    "CREDITS": 3,
    "SLOT": "E2+TE2",
    "FACULTY": "SWETHA R KUMAR"
  },
  {
    "CODE": "BEEE410L",
    "TITLE": "Machine Learning",
    "TYPE": "TH",
    "CREDITS": 3,
    "SLOT": "E1+TE1",
    "FACULTY": "JAMUNA K"
  },
  {
    "CODE": "BASTS101",
    "TITLE": "Qualitative and Quantitative Skills Practice I",
    "TYPE": "SS",
    "CREDITS": 1,
    "SLOT": "B1+TB1",
    "FACULTY": "ACAD"
  },
  {
    "CODE": "BAEEE103",
    "TITLE": "Analog Electronics",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "F1+TF1",
    "FACULTY": "Dr. Binu Ben Jose D R"
  },
  {
    "CODE": "BAEEE202",
    "TITLE": "Control Systems",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "A1+TA1",
    "FACULTY": "Dr. Deepa T"
  },
  {
    "CODE": "BAEEE206",
    "TITLE": "Microcontroller and Embedded C Programming",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "C1+TC1",
    "FACULTY": "Dr. Vijayapriya R"
  },
  {
    "CODE": "BAEEE205",
    "TITLE": "Electrical Machines",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "D1+TD1",
    "FACULTY": "Dr. Umayal C"
  },
  {
    "CODE": "BAHUM103",
    "TITLE": "Ethics and Values",
    "TYPE": "TH",
    "CREDITS": 2,
    "SLOT": "G1",
    "FACULTY": "Dr. Nithya Venkatesan"
  },
  {
    "CODE": "BSTS301P",
    "TITLE": "Advanced Competitive Coding - I",
    "TYPE": "SS",
    "CREDITS": 3,
    "SLOT": "D1+TD1",
    "FACULTY": "ACAD"
  },
  {
    "CODE": "BECE355L",
    "TITLE": "AWS for Cloud Computing",
    "TYPE": "TH",
    "CREDITS": 3,
    "SLOT": "C1+TC1",
    "FACULTY": "Dr. UMA MAHESWARI"
  },
  {
    "CODE": "BEEE304L",
    "TITLE": "Power Systems Engineering",
    "TYPE": "TH",
    "CREDITS": 4,
    "SLOT": "A1+TA1+TAA1",
    "FACULTY": "Dr. Meera P S"
  },
  {
    "CODE": "BEEE309L",
    "TITLE": "Microprocessors and Microcontrollers",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "B1+TB1",
    "FACULTY": "Dr. Vijayapriya R"
  },
  {
    "CODE": "BEEE309P",
    "TITLE": "Microprocessors and Microcontrollers",
    "TYPE": "ELA",
    "CREDITS": 1,
    "SLOT": "L51+L52",
    "FACULTY": "Dr. Vijayapriya R"
  },
  {
    "CODE": "BEEE302L",
    "TITLE": "Digital Signal Processing",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "E1+TE1",
    "FACULTY": "Dr. Umayal C"
  },
  {
    "CODE": "BEEE302P",
    "TITLE": "Digital Signal Processing",
    "TYPE": "ELA",
    "CREDITS": 1,
    "SLOT": "L39+L40",
    "FACULTY": "Dr. Umayal C"
  },
  {
    "CODE": "BEEE312P",
    "TITLE": "AC Machines",
    "TYPE": "ELA",
    "CREDITS": 1,
    "SLOT": "L31+L32",
    "FACULTY": "Dr. Sri Ramalakshmi P"
  },
  {
    "CODE": "BEEE411L",
    "TITLE": "Artificial Intelligence",
    "TYPE": "TH",
    "CREDITS": 3,
    "SLOT": "F1+TF1",
    "FACULTY": "Dr. Krishna Kumba"
  },
  {
    "CODE": "BEEE409L",
    "TITLE": "Industrial IoT",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "F2+TF2",
    "FACULTY": "Dr. Morla Lakshmi Siva Sai Kumar"
  },
  {
    "CODE": "BEEE409P",
    "TITLE": "Industrial IoT",
    "TYPE": "ELA",
    "CREDITS": 1,
    "SLOT": "L15+L16",
    "FACULTY": "Dr. Morla Lakshmi Siva Sai Kumar"
  },
  {
    "CODE": "BEEE416L",
    "TITLE": "Electric Vehicles",
    "TYPE": "TH",
    "CREDITS": 3,
    "SLOT": "D1+TD1",
    "FACULTY": "Dr. Balamurugan P"
  },
  {
    "CODE": "BEEE406L",
    "TITLE": "FACTS AND HVDC",
    "TYPE": "TH",
    "CREDITS": 3,
    "SLOT": "B1+TB1",
    "FACULTY": "Dr. Vaithilingam C"
  },
  {
    "CODE": "BEEE202L",
    "TITLE": "Electromagnetic Theory",
    "TYPE": "TH",
    "CREDITS": 3,
    "SLOT": "D2+TD2",
    "FACULTY": "Dr. Anantha Krishnan V"
  },
  {
    "CODE": "BEEE303P",
    "TITLE": "Control Systems",
    "TYPE": "ELA",
    "CREDITS": 1,
    "SLOT": "L11+L12",
    "FACULTY": "SELECT FACULTY"
  },
  {
    "CODE": "STS2012",
    "TITLE": "Aptitude and Reasoning Skills",
    "TYPE": "SS",
    "CREDITS": 1.5,
    "SLOT": "F2+TF2",
    "FACULTY": "FACE (APT)"
  },
  {
    "CODE": "BACSE106",
    "TITLE": "Operating Systems",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "BACSE106 - Operating Systems - Embedded Theory and Lab",
    "FACULTY": "Embedded Theory / Embedded Lab"
  },
  {
    "CODE": "BACSE202",
    "TITLE": "Database Systems",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "BACSE202 - Database Systems - Embedded Theory and Lab",
    "FACULTY": "Embedded Theory / Embedded Lab"
  },
  {
    "CODE": "BAMAT205",
    "TITLE": "Discrete Mathematics and Linear Algebra",
    "TYPE": "ETH",
    "CREDITS": 4,
    "SLOT": "BAMAT205 - Discrete Mathematics and Linear Algebra - Theory Only",
    "FACULTY": "Theory Only"
  },
  {
    "CODE": "BACSE201",
    "TITLE": "Models of Computation",
    "TYPE": "ETH",
    "CREDITS": 4,
    "SLOT": "BACSE201 - Models of Computation - Theory Only",
    "FACULTY": "Theory Only"
  },
  {
    "CODE": "BACSE102",
    "TITLE": "Problem Solving Using Java",
    "TYPE": "ETH",
    "CREDITS": 0,
    "SLOT": "BACSE102 - Problem Solving Using Java - Lab Only",
    "FACULTY": "Lab Only"
  },
  {
    "CODE": "BACSE344",
    "TITLE": "Cloud Infrastructure and Architecture",
    "TYPE": "ETH",
    "CREDITS": 4,
    "SLOT": "BACSE344 - Cloud Infrastructure and Architecture - Theory Only",
    "FACULTY": "Theory Only"
  }
] as const;

export default data;
