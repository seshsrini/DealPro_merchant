
const odishaData: Record<string, string[]> = {
  "Bhubaneswar": [
    "Jayadev Vihar", "Saheed Nagar", "Patia", "Khandagiri", "Nayapalli", "Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 6",
    "Unit 8", "Unit 9", "Old Town", "Laxmi Sagar", "Bomikhal", "Rasulgarh", "Mancheswar", "VSS Nagar", "Sahid Nagar", "Satya Nagar",
    "Bapuji Nagar", "Ashok Nagar", "Janpath Area", "Master Canteen", "Rajmahal Square", "Kalpana Square", "Cuttack Road", "Puri Road", "Samantrapur", "Lingaraj Temple Area",
    "Kalinga Nagar", "Dumuduma", "Jagamara", "Pokhariput", "Airfield Area", "Aerodrome Area", "Sundarpada", "Kapila Prasad", "Bhimitangi", "Palasuni",
    "Baramunda", "IRC Village", "Salia Sahi", "Chandrasekharpur", "Sailashree Vihar", "Niladri Vihar", "Gajapati Nagar", "Damana", "Raghunathpur", "Nandankanan Road"
  ],
  "Cuttack": [
    "Badambadi", "Link Road", "Dolamundai", "Ranihat", "Mangalabag", "Sati Chaura", "Buxi Bazar", "Chandi Road", "Tulasipur", "Cantonment Road",
    "Kanika Square", "Deulasahi", "Shelter Chhak", "Bidanasi", "CDA Sector 6", "CDA Sector 7", "CDA Sector 8", "CDA Sector 9", "CDA Sector 10", "CDA Sector 11",
    "Choudhury Bazar", "Nayasarak", "Balubazar", "Binodbehari", "Darghabazar", "Pithapur", "Oriyabazar", "Kathajodi Riverfront", "Mahanadi Riverfront", "Jobra",
    "Chauliaganj", "Nayabazar", "Madhupatna", "Khurannagar", "Gopalpur", "Sikharpur", "Jagatsinghpur Road", "Kandarpur Road", "Salipur Road", "Choudwar",
    "Malgodown", "College Square", "Ravenshaw University Area", "SCB Medical College Area", "Jobra Barrage Area", "Mahanadi Vihar", "Gandarpur", "Nuapada", "Talasahi", "Puri Ghat"
  ],
  "Rourkela": [
    "Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6", "Sector 7", "Sector 8", "Sector 9", "Sector 13",
    "Sector 14", "Sector 15", "Sector 16", "Sector 17", "Sector 18", "Sector 19", "Sector 20", "Sector 21", "Civil Township", "Koel Nagar",
    "Shakti Nagar", "Basanti Colony", "Udit Nagar", "Fertilizer Township", "Steel Township", "REC Campus Area", "NIT Area", "Railway Colony", "Bondamunda", "Lathikata",
    "Kalunga", "Raghunathpalli", "Panposh", "Vedvyas", "Birmitrapur Road", "Rajgangpur Road", "Kuanrmunda", "Bisra", "Nuagaon", "Tarkera",
    "Main Road", "Daily Market", "Bisra Road", "Station Road", "Ambagan Area", "Gajapati Market", "Ispat Market", "Sector 2 Market", "Koel Riverfront", "Brahmani Riverfront"
  ],
  "Berhampur": [
    "Gandhi Nagar", "Giri Road", "Bada Bazar", "Sana Bazar", "Bijipur", "Lanjipalli", "Kamapalli", "Ambapua", "Khodasingi", "Engineering School Area",
    "Medical College Area", "Brahmapur City", "Railway Station Area", "Bus Stand Area", "Silk City Area", "Gosaninuagaon", "Baidiyanathpur", "Anand Nagar", "Shanti Nagar", "Vikas Nagar",
    "Ram Nagar", "Krishna Nagar", "Ganesh Nagar", "Radha Nagar", "Hanuman Nagar", "Bajrang Bali Area", "Shiv Mandir Area", "Courtpeta", "Hillpatna", "Khalikote College Area",
    "Gate Bazaar", "Lochapada Road", "Digapahandi Road", "Aska Road", "Chatrapur Road", "Gopalpur Road", "Nilakanthanagar", "Ayodhya Nagar", "Sriram Nagar", "Sarbamangala Area",
    "First Gate", "Second Gate", "Third Gate", "Old Berhampur", "Mishra Sahi", "Agraharam", "Panigrahi Sahi", "Desibehera Street", "Khaspa Street", "Bhalia Sahi"
  ],
  "Sambalpur": [
    "Budharaja", "Khetrajpur", "Sakshipada", "Modipada", "Bareipali", "Dhanupali", "Ainthapali", "Golbazar", "Farm Road", "Brooks Hill",
    "VSSUT Area", "Burla", "Hirakud", "Sambalpur City", "Railway Station Area", "Bus Stand Area", "Collectorate Area", "Police Line Area", "Medical College Area", "University Area",
    "Sadar Bazar", "Sarafa", "Grain Market", "Industrial Area", "Hirakud Dam Area", "Chiplima Road", "Jharsuguda Road", "Bargarh Road", "Sonepur Road", "Deogarh Road",
    "Shanti Nagar", "Vikas Nagar", "Adarsh Nagar", "Pragati Nagar", "Nehru Nagar", "Gandhi Nagar", "Tilak Nagar", "Azad Nagar", "Patel Nagar", "Ram Nagar",
    "Krishna Nagar", "Ganesh Nagar", "Radha Nagar", "Hanuman Nagar", "Bajrang Bali Area", "Shiv Mandir Area", "Samaleswari Temple Area", "Mahanadi Riverfront", "Ring Road", "Nelson Mandela Chowk"
  ],
  "Puri": [
    "Grand Road", "Bada Danda", "Jagannath Temple Area", "Swargadwar", "Baliapanda", "Chakra Tirtha Road", "Puri Beach", "Sea Inn Area", "Gundicha Temple Area", "Narendra Kona",
    "Markandeswar Sahi", "Baseli Sahi", "Matitota", "Puri Town", "Railway Station Area", "Bus Stand Area", "Penthakata", "Matiapada", "Chandanpur Road", "Konark Road",
    "Bhubaneswar Road", "Brahmagiri Road", "Satapada Road", "Malatipatpur", "Balighai", "Sakhigopal", "Pipili", "Delang", "Nimapada", "Kakatpur",
    "Shanti Nagar", "Vikas Nagar", "Adarsh Nagar", "Pragati Nagar", "Nehru Nagar", "Gandhi Nagar", "Tilak Nagar", "Azad Nagar", "Patel Nagar", "Ram Nagar",
    "Krishna Nagar", "Ganesh Nagar", "Radha Nagar", "Hanuman Nagar", "Bajrang Bali Area", "Shiv Mandir Area", "Atharanala", "Mangalaghat", "Siddhamahavir Area", "Loknath Temple Area"
  ],
  "Balasore": [
    "Sahadevkhunta", "Azimabad", "Kuruda", "Remuna", "Gopalgaon", "Sunhat", "Manikhamb", "Proof Road", "Station Road", "Bus Stand Area",
    "Balasore City", "Railway Colony", "Industrial Estate", "Police Line Area", "Court Area", "Medical College Area", "University Area", "Fakir Mohan Gola", "Chandipur Road", "Jaleswar Road",
    "Bhadrak Road", "Nilagiri Road", "Soro Road", "Khantapada", "Basta", "Baliapal", "Jaleswar", "Raibania", "Bhograi", "Chandaneswar",
    "Shanti Nagar", "Vikas Nagar", "Adarsh Nagar", "Pragati Nagar", "Nehru Nagar", "Gandhi Nagar", "Tilak Nagar", "Azad Nagar", "Patel Nagar", "Ram Nagar",
    "Krishna Nagar", "Ganesh Nagar", "Radha Nagar", "Hanuman Nagar", "Bajrang Bali Area", "Shiv Mandir Area", "Damodarpur", "Ganeswarpur", "Saharad", "Bankeswar"
  ],
  "Bhadrak": [
    "Bhadrak Town", "Charampa", "Ranital", "Basudevpur", "Chandbali", "Dhamra", "Bant", "Bonth", "Tihidi", "Dhamnagar",
    "Bhandaripokhari", "Railway Station Area", "Bus Stand Area", "Collectorate Area", "Police Line Area", "Medical College Area", "University Area", "Sadar Bazar", "Sarafa", "Grain Market",
    "Shanti Nagar", "Vikas Nagar", "Adarsh Nagar", "Pragati Nagar", "Nehru Nagar", "Gandhi Nagar", "Tilak Nagar", "Azad Nagar", "Patel Nagar", "Ram Nagar",
    "Krishna Nagar", "Ganesh Nagar", "Radha Nagar", "Hanuman Nagar", "Bajrang Bali Area", "Shiv Mandir Area", "Eram", "Aradi", "Gupteswar Area", "Akhandalamani Area",
    "Bhadrak Bypass", "Salandi River Area", "Gabgaon", "Kuans", "Apartibinda", "Januganj", "Puruna Bazar", "Gelpur", "Kodabaruan", "Dahisada"
  ]
};

export default odishaData;
