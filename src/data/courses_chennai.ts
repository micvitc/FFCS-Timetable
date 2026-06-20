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
    "TITLE": "Control Systems",
    "TYPE": "LO",
    "CREDITS": 1,
    "SLOT": "L5+L6",
    "FACULTY": "MITHU SARKAR"
  },
  {
    "CODE": "BEEE309L",
    "TITLE": "Microprocessors and Microcontrollers",
    "TYPE": "TH",
    "CREDITS": 3,
    "SLOT": "F1+TF1",
    "FACULTY": "PRITAM"
  },
  {
    "CODE": "BEEE309P",
    "TITLE": "Microprocessors and Microcontrollers",
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
    "TITLE": "AC Machines",
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
    "SLOT": "E1+TE1",
    "FACULTY": "SHOLA USHA RANI"
  },
  {
    "CODE": "BACSE202",
    "TITLE": "Database Systems",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "D1+TD1",
    "FACULTY": "BHUVANESWARI"
  },
  {
    "CODE": "BAMAT205",
    "TITLE": "Discrete Mathematics and Linear Algebra",
    "TYPE": "ETH",
    "CREDITS": 4,
    "SLOT": "D1+TD1+TDD1",
    "FACULTY": "PADMAJA N"
  },
  {
    "CODE": "BACSE201",
    "TITLE": "Models of Computation",
    "TYPE": "ETH",
    "CREDITS": 4,
    "SLOT": "A1+TA1+TAA1",
    "FACULTY": "SURESHKUMAR WI"
  },
  {
    "CODE": "BACSE102",
    "TITLE": "Problem Solving Using Java",
    "TYPE": "ELA",
    "CREDITS": 2,
    "SLOT": "L1+L2+L19+L20",
    "FACULTY": "KANNIGA DEVI R"
  },
  {
    "CODE": "BACSE344",
    "TITLE": "Cloud Infrastructure and Architecture",
    "TYPE": "ETH",
    "CREDITS": 4,
    "SLOT": "C1+TC1+TCC1",
    "FACULTY": "ANANDAN P"
  },
  {
    "CODE": "BAESP101",
    "TITLE": "Spanish Level I",
    "TYPE": "Embedded Theory / Embedded Lab",
    "CREDITS": 2,
    "SLOT": "TE2",
    "FACULTY": "TRISHA",
    "VENUE": "AB2-401"
  },
  {
    "CODE": "BAFRE101",
    "TITLE": "French Level I",
    "TYPE": "Embedded Theory / Embedded Lab",
    "CREDITS": 2,
    "SLOT": "TE1",
    "FACULTY": "GOVINDARAJAN P",
    "VENUE": "AB1-402"
  },
  {
    "CODE": "BAGER101",
    "TITLE": "German Level I",
    "TYPE": "Embedded Theory / Embedded Lab",
    "CREDITS": 2,
    "SLOT": "TE2",
    "FACULTY": "VEENA PANI",
    "VENUE": "AB1-309"
  },
  {
    "CODE": "BAHUM106",
    "TITLE": "Micro Economics - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 3,
    "SLOT": "G1+TG1",
    "FACULTY": "SHALINA SUSAN MATHEW",
    "VENUE": "AB3-508"
  },
  {
    "CODE": "BAHUM109",
    "TITLE": "Principles of Sociology - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 3,
    "SLOT": "G2+TG2",
    "FACULTY": "URJANI",
    "VENUE": "AB3-308"
  },
  {
    "CODE": "BAHUM110",
    "TITLE": "Sustainability and Society - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 3,
    "SLOT": "G2+TG2",
    "FACULTY": "ROOPESH O B",
    "VENUE": "AB3-307"
  },
  {
    "CODE": "BAHUM111",
    "TITLE": "Introduction to Psychology - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 3,
    "SLOT": "G2+TG2",
    "FACULTY": "MAYA RATHNASABAPATHY",
    "VENUE": "AB3-508"
  },
  {
    "CODE": "BAHUM112",
    "TITLE": "Psychology in Everyday Life - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 3,
    "SLOT": "G1+TG1",
    "FACULTY": "VIJAYABANU U",
    "VENUE": "AB3-408"
  },
  {
    "CODE": "BAHUM251",
    "TITLE": "Indian Constitution - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 3,
    "SLOT": "G2+TG2",
    "FACULTY": "ARUN KUMAR G",
    "VENUE": "AB3-608"
  },
  {
    "CODE": "BAJAP101",
    "TITLE": "Japanese Level I",
    "TYPE": "Embedded Theory / Embedded Lab",
    "CREDITS": 2,
    "SLOT": "TE1",
    "FACULTY": "M JAYASHREE DASS",
    "VENUE": "AB1-610"
  },
  {
    "CODE": "BABIT314",
    "TITLE": "Food Nutrition and Health - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 4,
    "SLOT": "D2+TD2+TDD2",
    "FACULTY": "SIVAKAMAVALLI J",
    "VENUE": "AB3-405"
  },
  {
    "CODE": "BACLE402",
    "TITLE": "Engineering Geology - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 4,
    "SLOT": "A1+TA1+TAA1",
    "FACULTY": "MOHAN K",
    "VENUE": "AB1-702"
  },
  {
    "CODE": "BAECE206",
    "TITLE": "Digital Signal Processing",
    "TYPE": "Embedded Theory / Embedded Lab",
    "CREDITS": 4,
    "SLOT": "G1+TG1",
    "FACULTY": "RAMESH R",
    "VENUE": "AB1-308"
  },
  {
    "CODE": "BAHUM202",
    "TITLE": "Security Analysis and Portfolio Management - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 3,
    "SLOT": "G1+TG1",
    "FACULTY": "AHMAD HASAN",
    "VENUE": "AB3-704"
  },
  {
    "CODE": "BAHUM204",
    "TITLE": "Fixed Income Securities - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 3,
    "SLOT": "G2+TG2",
    "FACULTY": "BUVANESH",
    "VENUE": "AB2-708"
  },
  {
    "CODE": "BACSE105",
    "TITLE": "Data Structures and Algorithms",
    "TYPE": "Embedded Theory / Embedded Lab",
    "CREDITS": 4,
    "SLOT": "F1+TF1",
    "FACULTY": "MERCY RAJASELVI BEAULAH P",
    "VENUE": "AB1-609"
  },
  {
    "CODE": "BAECE203",
    "TITLE": "Analog Electronics",
    "TYPE": "Embedded Theory / Embedded Lab",
    "CREDITS": 4,
    "SLOT": "A1+TA1",
    "FACULTY": "SANGEETHA R G",
    "VENUE": "AB1-608"
  },
  {
    "CODE": "BAECE204",
    "TITLE": "Microcontrollers and Embedded C Programming",
    "TYPE": "Embedded Theory / Embedded Lab",
    "CREDITS": 4,
    "SLOT": "F1+TF1",
    "FACULTY": "MANOJ KUMAR R",
    "VENUE": "AB4-517"
  },
  {
    "CODE": "BAMAT209",
    "TITLE": "Mathematical Foundations for Computation - Theory Only",
    "TYPE": "Theory Only",
    "CREDITS": 4,
    "SLOT": "D1+TD1+TDD1",
    "FACULTY": "DHIVYA P",
    "VENUE": "AB1-609"
  },
  {
    "CODE": "BACSE350",
    "TITLE": "Block Chain Technology : Blockchain Architecture and Design",
    "TYPE": "ETH",
    "CREDITS": 4,
    "SLOT": "C1+TC1+TCC1",
    "FACULTY": "MALATHI G"
  },
  {
    "CODE": "BACSE341",
    "TITLE": "Augmented Reality : Fundamentals of Augmented and Virtual Reality",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "C1+TC1",
    "FACULTY": "SRIDHAR R"
  },
  {
    "CODE": "BACSE103",
    "TITLE": "Computation Structure",
    "TYPE": "ETH",
    "CREDITS": 3,
    "SLOT": "G1+TG1",
    "FACULTY": "NITHYA DARISINI  P S"
  }
] as const;

export default data;
