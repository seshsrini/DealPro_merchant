
const biharData: Record<string, string[]> = {
  "Patna": [
    "Boring Road", "Patliputra Colony", "Kankarbagh", "Rajendra Nagar", "Bailey Road", "Fraser Road", "Exhibition Road", "Gandhi Maidan Area", "Dak Bungalow Crossing", "Maurya Lok Area",
    "Kidwaipuri", "SK Puri", "Anandpuri", "Indrapuri", "Ashiana Nagar", "Khajpura", "Raja Bazar", "Jagdeo Path", "Gola Road", "Danapur",
    "Khagaul", "Phulwari Sharif", "Patna City", "Gulzarbagh", "Mahendru", "Ashok Rajpath", "Kadamkuan", "Lohanipur", "Naya Tola", "Bari Path",
    "Bakarganj", "Machuatoli", "Musallahpur Hat", "Saidpur", "Bhiknapahari", "Agamkuan", "Zero Mile Area", "Pahadi Area", "Kumhrar", "Sampatchak",
    "Parsa Bazar", "Anisabad", "Beur", "Gardanibagh", "Chitkohra", "Walmi", "AIIMS Patna Area", "Neora", "Bihta Road", "Maner Road"
  ],
  "Gaya": [
    "Vishnupad Temple Area", "Gaya Town", "Bodhy Gaya Road", "Magadh University Area", "Delha", "Manpur", "Paharpur", "Gaya Junction Area", "GB Road", "Swarajpuri Road",
    "Civil Lines", "Ramna Road", "Murarpur", "White House Compound", "Karier Area", "Chand Chaura", "Andar Gaya", "Nadraganj", "Gol Bagicha", "Gaya College Area",
    "Magadh Medical College Area", "AP Colony", "Katari Hill Road", "Dandibagh", "Gautam Buddha Marg", "Riverside Road", "Surajkund", "Akshatwat Area", "Mangala Gauri Area", "Pretshila Area",
    "Bodh Gaya", "Mahabodhi Temple Area", "Japanese Temple Area", "Tibetan Monastery Area", "Sujata Kuti Area", "Niranjana River Area", "Bakrour", "Domuhan", "Mastipur", "Tika Bigha",
    "Cherki Road", "Sherghati Road", "Dobhi Road", "Tekari Road", "Barachatti Road", "Imamganj Road", "Wazirganj Road", "Khizirsarai Road", "Belaganj Road", "Fatehpur Road"
  ],
  "Bhagalpur": [
    "Adampur", "Khanjarpur", "Manik Sarkar", "Khalifabagh", "Suja Ganj", "Variety Chowk Area", "Station Road", "Tilkamanjhi", "Barari", "Mayaganj",
    "Bhagalpur University Area", "JLN Medical College Area", "Zero Mile", "Sabour", "Nathnagar", "Champanagar", "Mirjanhat", "Aliganj", "Ishakchak", "Bhikhanpur",
    "Mundichak", "Kajvalichak", "Urdu Bazar", "Tatari Bazar", "Parbatti", "Sahibganj", "Mojahidpur", "Babupur", "Habibpur", "Jagdishpur Road",
    "Amarpur Road", "Banka Road", "Goda Road", "Purnia Road", "Katihar Road", "Munger Road", "Sultanganj Road", "Akbarnagar", "Ghogha", "Colgong",
    "Pirpainti", "Kahalgon", "Sanhoula", "Shahkund", "Sultanganj", "Tarapur Road", "Asarganj", "Katoria Road", "Bounsi Road", "Dhauni"
  ],
  "Muzaffarpur": [
    "Mithanpura", "Mariyam Nagar", "Aghoria Bazar", "Kalambagh Road", "Damodarpur", "Bhagwanpur", "Ramna", "Chhata Bazar", "Motijheel", "Sarayaganj",
    "Jawaharlal Road", "Company Bagh", "Sahu Road", "Gola Road", "Purani Bazar", "Brahmpura", "Kacchi Sarai", "Zila Parishad Area", "SKMCH Area", "Muzaffarpur Junction Area",
    "Bela Industrial Area", "Patahi Area", "Kanti Road", "Motihari Road", "Patna Road", "Darbhanga Road", "Sitamarhi Road", "Rewa Road", "Hajipur Road", "Laxmi Chowk Area",
    "Gobarshahi", "Dumri", "Mushari", "Bochahan", "Minapur", "Katra", "Aurai", "Sahebganj Road", "Paroo", "Saraiya",
    "Kurhani", "Sakra", "Muraul", "Bandra", "Dholi", "Pusa Road", "Sakri Road", "Muzaffarpur Town", "Club Road", "Majhaulia"
  ],
  "Purnia": [
    "Line Bazar", "Gulabbagh", "Khushki Bagh", "Madhubani", "Sipahi Tola", "Navratan Hatta", "Marwari Patty", "Bhatta Bazar", "Rambagh", "Purnia City",
    "Kasba", "Banmankhi Road", "Dhamdaha Road", "Rupauli Road", "Araria Road", "Katihar Road", "Saharsa Road", "Madhepura Road", "Raniganj Road", "Forbesganj Road",
    "Purnia Junction Area", "Purnia Court Area", "Bus Stand Area", "Medical College Area", "Purnia University Area", "Chunapur Area", "Hardagram", "Belauri", "Maranga", "Nevatoli",
    "Ganeshpur", "Dogachi", "Srinagar Road", "Jalalgarh Road", "Amour Road", "Baisa", "Kishanganj Road", "Dagarua", "Baisi", "Dhamdaha",
    "Bhawanipur", "Rupauli", "Krityanand Nagar", "Banmankhi", "Barhara Kothi", "Dharhara", "Champanagar", "Kala Bhawan Area", "Indira Gandhi Stadium Area", "Rajendra Bal Udyan Area"
  ],
  "Darbhanga": [
    "Laheriasarai", "Darbhanga Town", "Donar", "Benta", "Darbhanga Tower Area", "Lalbagh", "Kathalbari", "Mirzapur", "Dighi West", "Dighi East",
    "Gola Road", "Bara Bazar", "Hindi Bazar", "Pusa Road", "Samastipur Road", "Madhubani Road", "Muzaffarpur Road", "Sitamarhi Road", "Saharsa Road", "Kamtaul Road",
    "Darbhanga Junction Area", "Laheriasarai Junction Area", "DMCH Area", "Mithila University Area", "Kameshwar Singh Sanskrit University Area", "Kadiraabad", "Shisho", "Mabbi", "Bahadurpur", "Hanuman Nagar",
    "Keoti", "Singhwara", "Jale", "Biraul", "Kusheshwar Asthan Road", "Baheri", "Benipur Road", "Alinagar", "Ghanshyampur", "Tardih",
    "Manigachhi", "Pandaul Road", "Sakri", "Lohat", "Pandaul", "Jhanjharpur Road", "Basopatti", "Khajauli Road", "Raj Nagar Road", "Phulparas Road"
  ],
  "Bihar Sharif": [
    "Nalanda College Area", "Soghra High School Area", "Ranchi Road", "Patna Road", "Bakhtiyarpur Road", "Hilsa Road", "Nawada Road", "Barbigha Road", "Sheikhpura Road", "Rajgir Road",
    "Pawapuri Road", "Bazaar Samiti Area", "Khandakpar", "Badi Pahari", "Chhoti Pahari", "Saluganj", "Mahadevpur", "Kamruddinganj", "Amber", "Bhainsasur",
    "Murarpur", "Dahipar", "Muraura", "Naisarai", "Ashanagar", "Ramchandrapur", "Bihar Sharif Junction Area", "Bus Stand Area", "Civil Court Area", "District Board Area",
    "Nalanda", "Rajgir", "Pawapuri", "Hilsa", "Islampur", "Silao", "Giriak", "Sarmera", "Asthawan", "Noorsarai",
    "Harnaut", "Rahui", "Bind", "Chandi", "Tharthari", "Parwalpur", "Ben", "Nagarnausa", "Karai Parsurai", "Ghoswari"
  ],
  "Arrah": [
    "Arrah Town", "Ramna Road", "Station Road", "Maulabag", "Gopali Chak", "Pakari", "Chandwa", "Dharamshala Road", "Maharaja College Area", "VKS University Area",
    "Buxar Road", "Patna Road", "Sasaram Road", "Jagdishpur Road", "Piro Road", "Shahpur Road", "Behea Road", "Udwant Nagar", "Gadhani", "Koilwar",
    "Arrah Junction Area", "Bus Stand Area", "Civil Court Area", "Collectorate Area", "Police Line Area", "Arrah Block", "Sandesh Road", "Sahara", "Agiaon Road", "Tarari Road",
    "Charpokhari Road", "Bihiya", "Jagdishpur", "Piro", "Shahpur", "Koilwar Bridge Area", "Babura Road", "Barhara", "Sinha", "Lauhar",
    "Ekwari", "Nanhau", "Sakaraddi", "Gundi", "Belaur", "Bakhorapur", "Dhangai", "Karath", "Nonar", "Jitoura"
  ]
};

export default biharData;
