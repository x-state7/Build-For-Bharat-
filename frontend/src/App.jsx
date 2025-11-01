import React, { useState, useEffect } from 'react';
import { 
  MapPin, TrendingUp, Users, Calendar, Info, AlertCircle, 
  CheckCircle, Clock, IndianRupee, RefreshCw, Volume2, 
  ChevronDown, Home,Landmark, Globe,Search, Phone, HelpCircle, Building, BarChart2, X
} from 'lucide-react';

// Framer Motion alternative - CSS-based animations
const FadeIn = ({ children, delay = 0, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  
  return (
    <div 
      className={`transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${className}`}
    >
      {children}
    </div>
  );
};

const ScaleIn = ({ children, delay = 0, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  
  return (
    <div 
      className={`transition-all duration-500 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      } ${className}`}
    >
      {children}
    </div>
  );
};

// Info Modal Component
const InfoModal = ({ title, text, onClose, lang }) => (
  <div 
    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-fadeIn"
    onClick={onClose}
  >
    <div 
      className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full border border-gray-200 animate-scaleIn"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold text-gray-800">{title}</h3>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      <p className={`text-lg text-gray-600 leading-relaxed ${lang === 'hi' ? 'leading-loose' : ''}`}>
        {text}
      </p>
    </div>
  </div>
);

// Data Card Component with enhanced styling
const DataCard = ({ title, value, icon: Icon, color, onInfoClick, infoText, speakText, voiceEnabled, speak }) => {
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md p-5 border border-gray-200 transition-all duration-300 hover:shadow-lg hover:scale-105">
      <div className="flex justify-between items-center mb-3">
        <div className={`p-3 rounded-lg ${color.replace('text', 'bg').replace('-700', '-100')} shadow-sm`}>
          <Icon size={24} className={color} />
        </div>
        <button
          onClick={() => onInfoClick({ title, text: infoText })}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          title="Info"
        >
          <Info size={18} />
        </button>
      </div>
      <button 
        className="text-left w-full group"
        onClick={() => voiceEnabled && speak(speakText)}
      >
        <p className="text-base text-gray-500 mb-1 font-medium group-hover:text-gray-700 transition-colors">{title}</p>
        <p className={`text-3xl font-bold ${color} group-hover:scale-105 transition-transform inline-block`}>{value}</p>
      </button>
    </div>
  );
};

const MGNREGADashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [district, setDistrict] = useState(null); 
  const [districtData, setDistrictData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [selectedYear, setSelectedYear] = useState('2024-2025');
  const [locationStatus, setLocationStatus] = useState('detecting');
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('cache');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDistrictList, setShowDistrictList] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [currentStep, setCurrentStep] = useState('language-select');
  const [selectedLanguage, setSelectedLanguage] = useState('hi');
  const [infoModal, setInfoModal] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  const translations = {
    hi: {
      appName: 'मनरेगा',
      selectLanguage: 'अपनी भाषा चुनें',
      selectDistrict: 'अपना जिला चुनें',
      detecting: 'आपका स्थान खोजा जा रहा है...',
      voiceOn: 'आवाज़ चालू है',
      voiceOff: 'आवाज़ चालू करें',
      totalJobCards: 'कुल जॉब कार्ड',
      activeWorkers: 'सक्रिय श्रमिक',
      totalWorkDays: 'कुल कार्य दिवस',
      perHousehold: 'प्रति परिवार औसत दिन',
      days: 'दिन',
      womenParticipation: 'महिला भागीदारी',
      completedWorks: 'पूर्ण हो चुके कार्य',
      ongoingWorks: 'चालू कार्य',
      wageInfo: 'मजदूरी की जानकारी',
      perDayWage: 'प्रतिदिन मजदूरी',
      totalExpenditure: 'कुल खर्च',
      needHelp: 'मदद चाहिए?',
      helpline: 'हेल्पलाइन नंबर',
      viewTrends: 'पिछले वर्षों का प्रदर्शन देखें',
      backToData: 'वर्तमान डेटा पर वापस जाएं',
      yearlyProgress: 'सालाना प्रगति',
      searchDistrict: 'जिला खोजें...',
      noData: 'डेटा उपलब्ध नहीं है',
      loadingData: 'डेटा लोड हो रहा है...',
      tapToHear: 'सुनने के लिए टैप करें',
      changeDistrict: 'जिला बदलें',
      refresh: 'ताज़ा करें',
      performance: 'प्रदर्शन',
      currentYear: 'वर्तमान वर्ष',
      progressSummary: 'प्रगति सारांश',
      totalGrowth: 'कुल वृद्धि',
      yearsTracked: 'साल ट्रैक किए',
      bestYear: 'सबसे अच्छा साल',
      excellent: 'बहुत अच्छा!',
      whatIsMGNREGA: 'मनरेगा क्या है?',
      mgnregaDesc: 'यह एक सरकारी योजना है जो ग्रामीण परिवारों को एक वित्तीय वर्ष में कम से कम 100 दिन के सवेतन रोजगार की गारंटी देती है।',
      helplineDesc: 'अधिक जानकारी के लिए, अपने स्थानीय ब्लॉक कार्यालय से संपर्क करें या 1800-180-6127 पर कॉल करें।',
      dataSource: 'डेटा स्रोत: भारत सरकार (data.gov.in)',
      lastUpdated: 'अंतिम अपडेट:',
      helplineTime: 'सोमवार से शुक्रवार, सुबह 10 बजे से शाम 6 बजे तक',
      noDistrictFound: 'कोई जिला नहीं मिला',
      loadingHistorical: 'पुराना डेटा लोड हो रहा है...',
      errorLoading: 'डेटा लोड करने में समस्या हुई। कृपया अपना कनेक्शन जांचें।',
      tryAgain: 'कृपया पुनः प्रयास करें या सहायता से संपर्क करें',
      noDataDistrict: 'इस जिले के लिए कोई डेटा उपलब्ध नहीं है',
      seeProgress: 'सालों की प्रगति देखें',
      partialData: 'आंशिक डेटा',
      yearToDate: 'वर्ष-दर-तारीख',
      completeYears: 'पूर्ण वर्ष',
      infoTotalJobCards: 'यह आपके जिले में पंजीकृत सभी परिवारों (जॉब कार्ड) की कुल संख्या है।',
      infoActiveWorkers: 'यह उन श्रमिकों की संख्या है जिन्होंने इस वर्ष कम से कम एक दिन काम किया है।',
      infoTotalWorkDays: 'यह इस वर्ष जिले के सभी श्रमिकों द्वारा मिलकर काम किए गए कुल दिनों की संख्या है।',
      infoPerHousehold: 'यह प्रति परिवार काम किए गए औसत दिनों की संख्या है। सरकार 100 दिनों का लक्ष्य रखती है।',
      infoWomenParticipation: 'कुल काम के दिनों में से कितने प्रतिशत दिन महिलाओं द्वारा काम किया गया।',
      infoCompletedWorks: 'इस वर्ष जिले में पूरे हो चुके कार्यों (जैसे तालाब, सड़क) की कुल संख्या।',
      infoOngoingWorks: 'उन कार्यों की संख्या जिन पर अभी भी काम चल रहा है।',
      infoPerDayWage: 'एक श्रमिक को एक दिन के काम के लिए मिलने वाली औसत राशि (रुपये में)।',
      infoTotalExpenditure: 'इस वर्ष मनरेगा के तहत मजदूरी और सामग्री पर खर्च की गई कुल राशि (करोड़ या लाख रुपये में)।',
      infoYearToDate: 'यह कार्ड **चालू वर्ष** का प्रदर्शन दिखाता है, जो साल की शुरुआत से लेकर आज तक का है। यह डेटा अभी आंशिक है और साल के अंत तक बढ़ेगा।',
      infoFullYear: 'यह कार्ड उस **पूरे वित्तीय वर्ष** (1 अप्रैल से 31 मार्च) के अंतिम, पूर्ण प्रदर्शन को दिखाता है।',
      infoTotalGrowth: 'यह सबसे हाल के *पूर्ण* वर्ष के प्रदर्शन की तुलना सबसे पुराने *पूर्ण* वर्ष से करता है ताकि लंबी अवधि का रुझान दिखाया जा सके।',
      infoYearsTracked: 'इस सारांश में उपलब्ध डेटा वाले वित्तीय वर्षों की कुल संख्या।',
      infoBestYear: 'वह वित्तीय वर्ष जिसमें सबसे अधिक \'कुल कार्य दिवस\' उत्पन्न हुए थे।',
    },
    en: {
      appName: 'MGNREGA',
      selectLanguage: 'Select Your Language',
      selectDistrict: 'Select Your District',
      detecting: 'Detecting your location...',
      voiceOn: 'Voice On',
      voiceOff: 'Turn On Voice',
      totalJobCards: 'Total Job Cards',
      activeWorkers: 'Active Workers',
      totalWorkDays: 'Total Work Days',
      perHousehold: 'Avg. Days / Household',
      days: 'Days',
      womenParticipation: 'Women Participation',
      completedWorks: 'Completed Works',
      ongoingWorks: 'Ongoing Works',
      wageInfo: 'Wage Information',
      perDayWage: 'Per Day Wage',
      totalExpenditure: 'Total Expenditure',
      needHelp: 'Need Help?',
      helpline: 'Helpline Number',
      viewTrends: 'View Past Years Performance',
      backToData: 'Back to Current Data',
      yearlyProgress: 'Yearly Progress',
      searchDistrict: 'Search district...',
      noData: 'No data available',
      loadingData: 'Loading data...',
      tapToHear: 'Tap to hear',
      changeDistrict: 'Change District',
      refresh: 'Refresh',
      performance: 'Performance',
      currentYear: 'Current Year',
      progressSummary: 'Progress Summary',
      totalGrowth: 'Total Growth',
      yearsTracked: 'Years Tracked',
      bestYear: 'Best Year',
      excellent: 'Excellent!',
      whatIsMGNREGA: 'What is MGNREGA?',
      mgnregaDesc: 'It is a government program that guarantees at least 100 days of paid employment in a financial year to rural households.',
      helplineDesc: 'For more information, contact your local block office or call 1800-180-6127.',
      dataSource: 'Data Source: Government of India (data.gov.in)',
      lastUpdated: 'Last Updated:',
      helplineTime: 'Monday to Friday, 10 AM to 6 PM',
      noDistrictFound: 'No district found',
      loadingHistorical: 'Loading historical data...',
      errorLoading: 'Error loading data. Please check your connection.',
      tryAgain: 'Please try again or contact support',
      noDataDistrict: 'No data available for this district',
      seeProgress: 'See progress over years',
      partialData: 'Partial Data',
      yearToDate: 'Year-to-Date',
      completeYears: 'Complete Years',
      infoTotalJobCards: 'The total number of all registered families (Job Cards) in your district.',
      infoActiveWorkers: 'The number of workers who have worked at least one day in this financial year.',
      infoTotalWorkDays: 'The total number of days worked by all workers combined in your district this year.',
      infoPerHousehold: 'The average number of days worked per family. The government aims for 100 days.',
      infoWomenParticipation: 'The percentage of total work days that were worked by women.',
      infoCompletedWorks: 'The total number of works (like ponds, roads) finished in the district this year.',
      infoOngoingWorks: 'The number of works that are still in progress.',
      infoPerDayWage: 'The average amount (in Rupees) paid to a worker for one day of work.',
      infoTotalExpenditure: 'The total amount (in Crores or Lakhs) spent on wages and materials under MGNREGA this year.',
      infoYearToDate: 'This card shows the performance for the **current year**, from the beginning of the year until today. This data is still partial and will grow.',
      infoFullYear: 'This card shows the **final, complete performance** for that entire financial year (April 1 to March 31).',
      infoTotalGrowth: 'This compares the performance of the most recent *complete* year with the oldest *complete* year to show the long-term trend.',
      infoYearsTracked: 'The total number of financial years for which data is available in this summary.',
      infoBestYear: 'The financial year that had the highest \'Total Work Days\' generated.',
    }
  };

  const t = translations[selectedLanguage];

  const upDistricts = [
    { key: 'AGRA', en: 'AGRA', hi: 'आगरा' },
    { key: 'ALIGARH', en: 'ALIGARH', hi: 'अलीगढ़' },
    { key: 'ALLAHABAD', en: 'ALLAHABAD', hi: 'इलाहाबाद' },
    { key: 'AMBEDKAR NAGAR', en: 'AMBEDKAR NAGAR', hi: 'अम्बेडकर नगर' },
    { key: 'AMETHI', en: 'AMETHI', hi: 'अमेठी' },
    { key: 'AMROHA', en: 'AMROHA', hi: 'अमरोहा' },
    { key: 'AURAIYA', en: 'AURAIYA', hi: 'औरैया' },
    { key: 'AZAMGARH', en: 'AZAMGARH', hi: 'आजमगढ़' },
    { key: 'BAGHPAT', en: 'BAGHPAT', hi: 'बागपत' },
    { key: 'BAHRAICH', en: 'BAHRAICH', hi: 'बहराइच' },
    { key: 'BALLIA', en: 'BALLIA', hi: 'बलिया' },
    { key: 'BALRAMPUR', en: 'BALRAMPUR', hi: 'बलरामपुर' },
    { key: 'BANDA', en: 'BANDA', hi: 'बांदा' },
    { key: 'BARABANKI', en: 'BARABANKI', hi: 'बाराबंकी' },
    { key: 'BAREILLY', en: 'BAREILLY', hi: 'बरेली' },
    { key: 'BASTI', en: 'BASTI', hi: 'बस्ती' },
    { key: 'BHADOHI', en: 'BHADOHI', hi: 'भदोही' },
    { key: 'BIJNOR', en: 'BIJNOR', hi: 'बिजनौर' },
    { key: 'BUDAUN', en: 'BUDAUN', hi: 'बदायूं' },
    { key: 'BULANDSHAHR', en: 'BULANDSHAHR', hi: 'बुलंदशहर' },
    { key: 'CHANDAULI', en: 'CHANDAULI', hi: 'चंदौली' },
    { key: 'CHITRAKOOT', en: 'CHITRAKOOT', hi: 'चित्रकूट' },
    { key: 'DEORIA', en: 'DEORIA', hi: 'देवरिया' },
    { key: 'ETAH', en: 'ETAH', hi: 'एटा' },
    { key: 'ETAWAH', en: 'ETAWAH', hi: 'इटावा' },
    { key: 'AYODHYA', en: 'AYODHYA', hi: 'अयोध्या' },
    { key: 'FARRUKHABAD', en: 'FARRUKHABAD', hi: 'फर्रुखाबाद' },
    { key: 'FATEHPUR', en: 'FATEHPUR', hi: 'फतेहपुर' },
    { key: 'FIROZABAD', en: 'FIROZABAD', hi: 'फिरोजाबाद' },
    { key: 'GAUTAM BUDDHA NAGAR', en: 'GAUTAM BUDDHA NAGAR', hi: 'गौतम बुद्ध नगर' },
    { key: 'GHAZIABAD', en: 'GHAZIABAD', hi: 'गाजियाबाद' },
    { key: 'GHAZIPUR', en: 'GHAZIPUR', hi: 'गाजीपुर' },
    { key: 'GONDA', en: 'GONDA', hi: 'गोंडा' },
    { key: 'GORAKHPUR', en: 'GORAKHPUR', hi: 'गोरखपुर' },
    { key: 'HAMIRPUR', en: 'HAMIRPUR', hi: 'हमीरपुर' },
    { key: 'HAPUR', en: 'HAPUR', hi: 'हापुड़' },
    { key: 'HARDOI', en: 'HARDOI', hi: 'हरदोई' },
    { key: 'HATHRAS', en: 'HATHRAS', hi: 'हाथरस' },
    { key: 'JALAUN', en: 'JALAUN', hi: 'जालौन' },
    { key: 'JAUNPUR', en: 'JAUNPUR', hi: 'जौनपुर' },
    { key: 'JHANSI', en: 'JHANSI', hi: 'झांसी' },
    { key: 'KANNAUJ', en: 'KANNAUJ', hi: 'कन्नौज' },
    { key: 'KANPUR DEHAT', en: 'KANPUR DEHAT', hi: 'कानपुर देहात' },
    { key: 'KANPUR NAGAR', en: 'KANPUR NAGAR', hi: 'कानपुर नगर' },
    { key: 'KASGANJ', en: 'KASGANJ', hi: 'कासगंज' },
    { key: 'KAUSHAMBI', en: 'KAUSHAMBI', hi: 'कौशाम्बी' },
    { key: 'KHERI', en: 'KHERI', hi: 'खेरी' },
    { key: 'KUSHINAGAR', en: 'KUSHINAGAR', hi: 'कुशीनगर' },
    { key: 'LALITPUR', en: 'LALITPUR', hi: 'ललितपुर' },
    { key: 'LUCKNOW', en: 'LUCKNOW', hi: 'लखनऊ' },
    { key: 'MAHARAJGANJ', en: 'MAHARAJGANJ', hi: 'महाराजगंज' },
    { key: 'MAHOBA', en: 'MAHOBA', hi: 'महोबा' },
    { key: 'MAINPURI', en: 'MAINPURI', hi: 'मैनपुरी' },
    { key: 'MATHURA', en: 'MATHURA', hi: 'मथुरा' },
    { key: 'MAU', en: 'MAU', hi: 'मऊ' },
    { key: 'MEERUT', en: 'MEERUT', hi: 'मेरठ' },
    { key: 'MIRZAPUR', en: 'MIRZAPUR', hi: 'मिर्जापुर' },
    { key: 'MORADABAD', en: 'MORADABAD', hi: 'मुरादाबाद' },
    { key: 'MUZAFFARNAGAR', en: 'MUZAFFARNAGAR', hi: 'मुजफ्फरनगर' },
    { key: 'PILIBHIT', en: 'PILIBHIT', hi: 'पीलीभीत' },
    { key: 'PRATAPGARH', en: 'PRATAPGARH', hi: 'प्रतापगढ़' },
    { key: 'PRAYAGRAJ', en: 'PRAYAGRAJ', hi: 'प्रयागराज' },
    { key: 'RAE BARELI', en: 'RAE BARELI', hi: 'रायबरेली' },
    { key: 'RAMPUR', en: 'RAMPUR', hi: 'रामपुर' },
    { key: 'SAHARANPUR', en: 'SAHARANPUR', hi: 'सहारनपुर' },
    { key: 'SAMBHAL', en: 'SAMBHAL', hi: 'सम्भल' },
    { key: 'SANT KABIR NAGAR', en: 'SANT KABIR NAGAR', hi: 'संत कबीर नगर' },
    { key: 'SANT RAVIDAS NAGAR', en: 'SANT RAVIDAS NAGAR', hi: 'संत रविदास नगर' },
    { key: 'SHAHJAHANPUR', en: 'SHAHJAHANPUR', hi: 'शाहजहांपुर' },
    { key: 'SHAMLI', en: 'SHAMLI', hi: 'शामली' },
    { key: 'SHRAVASTI', en: 'SHRAVASTI', hi: 'श्रावस्ती' },
    { key: 'SIDDHARTHNAGAR', en: 'SIDDHARTHNAGAR', hi: 'सिद्धार्थनगर' },
    { key: 'SITAPUR', en: 'SITAPUR', hi: 'सीतापुर' },
    { key: 'SONBHADRA', en: 'SONBHADRA', hi: 'सोनभद्र' },
    { key: 'SULTANPUR', en: 'SULTANPUR', hi: 'सुल्तानपुर' },
    { key: 'UNNAO', en: 'UNNAO', hi: 'उन्नाव' },
    { key: 'VARANASI', en: 'VARANASI', hi: 'वाराणसी' }
  ];

  const getDistrictDisplayName = (key) => {
    if (!key) return '';
    const districtObj = upDistricts.find(d => d.key === key);
    if (!districtObj) return key;
    return selectedLanguage === 'hi' ? districtObj.hi : districtObj.en;
  };

  const speak = (text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLanguage === 'en' ? 'en-IN' : 'hi-IN';
    utterance.rate = 0.8;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (currentStep === 'language-select') {
      setLoading(false);
    }
  }, [currentStep]);

  const detectUserLocation = async () => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      setCurrentStep('district-select');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/detect-district`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            })
          });
          
          const data = await response.json();
          const detected = data.district || 'LUCKNOW';
          
          setDistrict(detected.toUpperCase());
          setLocationStatus('detected');
          setCurrentStep('data-view');
          fetchDistrictData(detected.toUpperCase());
        } catch (err) {
          setCurrentStep('district-select');
          setLoading(false);
        }
      },
      (error) => {
        setLocationStatus('denied');
        setCurrentStep('district-select');
        setLoading(false);
      }
    );
  };

  const fetchDistrictData = async (districtName, forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const districtResponse = await fetch(
        `${API_BASE_URL}/api/district/${districtName}?finYear=${selectedYear}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!districtResponse.ok) throw new Error(`API error: ${districtResponse.status}`);
      const districtResult = await districtResponse.json();
      setDataSource(districtResult.source || 'unknown');
      const transformed = transformAPIData(districtResult.data, districtName);
      setDistrictData(transformed);
      
      const historicalResponse = await fetch(
        `${API_BASE_URL}/api/historical/${districtName}`
      );
      let historicalResult = { data: [] };
      if (historicalResponse.ok) {
        historicalResult = await historicalResponse.json();
      }

      const currentYearIndex = historicalResult.data.findIndex(
        (year) => year.year === selectedYear
      );

      const currentYearDataForHistory = {
        year: transformed.finYear,
        person_days_generated: transformed.personDaysGenerated,
        avg_days_per_household: transformed.averageDaysPerHousehold,
        active_job_cards: transformed.activeWorkers,
        active_workers: transformed.activeWorkers,
        women_participation_percent: transformed.womenParticipation,
        women_person_days: (transformed.personDaysGenerated * (transformed.womenParticipation / 100)),
        total_expenditure: transformed.expenditure,
        avg_wage_rate: transformed.avgWage,
        completed_works: transformed.completedWorks,
        ongoing_works: transformed.ongoingWorks,
        personDays: transformed.personDaysGenerated,
        households: transformed.activeWorkers
      };

      if (currentYearIndex > -1) {
        historicalResult.data[currentYearIndex] = currentYearDataForHistory;
      } else {
        historicalResult.data.unshift(currentYearDataForHistory);
      }

      setHistoricalData(historicalResult.data || []);
    }
    catch (err) {
      console.error('Fetch error:', err);
      setError(t.errorLoading);
      setDistrictData(null);
      setHistoricalData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const transformAPIData = (apiData, districtName) => {
    if (!apiData) return null;
    
    return {
      district: districtName,
      state: 'UTTAR PRADESH',
      finYear: apiData.fin_year || selectedYear,
      totalJobCards: apiData.job_cards_issued || 0,
      activeWorkers: apiData.active_job_cards || 0,
      personDaysGenerated: apiData.person_days_generated || 0,
      averageDaysPerHousehold: apiData.avg_days_per_household || 
        (apiData.person_days_generated / Math.max(apiData.active_job_cards, 1)).toFixed(2),
      womenParticipation: apiData.women_participation_percent || 
        ((apiData.women_person_days / Math.max(apiData.person_days_generated, 1)) * 100).toFixed(1),
      completedWorks: apiData.completed_works || 0,
      ongoingWorks: apiData.ongoing_works || 0,
      expenditure: apiData.total_expenditure || 0,
      avgWage: apiData.avg_wage_rate || 0
    };
  };

  const formatNumber = (num) => {
    if (!num || num === 0) return '0';
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} ${selectedLanguage === 'en' ? 'Cr' : 'करोड़'}`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)} ${selectedLanguage === 'en' ? 'L' : 'लाख'}`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)} ${selectedLanguage === 'en' ? 'K' : 'हज़ार'}`;
    return num.toString();
  };

  const handleDistrictSelect = (selectedDistrictKey) => {
    setDistrict(selectedDistrictKey);
    setCurrentStep('data-view');
    setShowDistrictList(false);
    fetchDistrictData(selectedDistrictKey);
    if (voiceEnabled) {
      speak(`${getDistrictDisplayName(selectedDistrictKey)} ${t.selectDistrict}`);
    }
  };

  const handleLanguageSelect = (lang) => {
    setSelectedLanguage(lang);
    setCurrentStep('welcome');
    setTimeout(() => {
      detectUserLocation();
    }, 500);
  };

  const filteredDistricts = upDistricts.filter(d => {
    const query = searchQuery.toLowerCase();
    return d.en.toLowerCase().includes(query) || d.hi.toLowerCase().includes(query);
  });

  if (currentStep === 'language-select') {
    const languages = [
      { code: 'hi', name: 'हिंदी', emoji: '🇮🇳' },
      { code: 'en', name: 'English', emoji: '🇬🇧' }
    ];

    return (
<div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center p-6 relative overflow-hidden">

  {/* Soft background glows */}
  <div className="absolute inset-0 opacity-15 pointer-events-none">
    <div className="absolute top-32 left-32 w-64 h-64 bg-amber-300 rounded-full blur-3xl animate-pulse"></div>
    <div className="absolute bottom-32 right-32 w-80 h-80 bg-orange-200 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.8s' }}></div>
  </div>

  <div className="text-center max-w-3xl w-full relative z-10">
    <FadeIn delay={0}>
      <div className="mb-10">
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-300 to-amber-300 rounded-full blur-xl opacity-30"></div>
          <div className="relative bg-white rounded-full p-6 shadow-xl border border-orange-200">
            <div className="text-7xl">🙏</div>
          </div>
        </div>

        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
          नमस्ते / Hello
        </h1>

        <p className="text-xl text-gray-700 font-medium">अपनी भाषा चुनें</p>
        <p className="text-lg text-gray-500">Select Your Language</p>
      </div>
    </FadeIn>

    {/* Language buttons */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-md mx-auto">
      {languages.map((lang, idx) => (
        <ScaleIn key={lang.code} delay={200 + idx * 100}>
          <button
            onClick={() => handleLanguageSelect(lang.code)}
            className="group relative bg-white border border-gray-200 hover:border-orange-400 rounded-2xl py-8 px-6 transition-all duration-300 shadow-md hover:shadow-xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative flex flex-col items-center">
              <div className="text-5xl mb-3 group-hover:scale-105 transition-transform duration-300">
                {lang.emoji}
              </div>
              <p className="text-2xl font-semibold text-gray-700 group-hover:text-orange-600 transition-colors duration-300">
                {lang.name}
              </p>
            </div>
          </button>
        </ScaleIn>
      ))}
    </div>

    <FadeIn delay={600}>
      <div className="mt-12 text-gray-600 text-md">
        <p className="animate-pulse">👆 अपनी भाषा चुनें</p>
        <p className="animate-pulse" style={{ animationDelay: '0.4s' }}>Click your language above</p>
      </div>
    </FadeIn>
  </div>
</div>


    );
  }

  if (currentStep === 'welcome' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <FadeIn>
            <div className="mb-8">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                <div className="relative text-8xl animate-bounce text-emerald-600">🏘️</div>
              </div>
              <h1 className="text-6xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">{t.appName}</h1>
              <p className="text-2xl text-gray-500">MGNREGA Dashboard</p>
            </div>
          </FadeIn>
          
          {loading && (
            <FadeIn delay={300}>
              <div className="space-y-4">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto"></div>
                  <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-b-4 border-emerald-400 mx-auto opacity-20"></div>
                </div>
                <p className="text-xl text-gray-600 animate-pulse">{t.detecting}</p>
              </div>
            </FadeIn>
          )}
        </div>
      </div>
    );
  }

  if (currentStep === 'district-select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <FadeIn>
            <div className="text-center mb-8">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                <div className="relative text-8xl text-emerald-700 animate-bounce">🗺️</div>
              </div>
              <h1 className="text-5xl font-bold text-gray-800 mb-2">{t.selectDistrict}</h1>
              <p className="text-lg text-gray-500">{t.tapToHear}</p>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="flex justify-center mb-6">
              <button
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled);
                  if (!voiceEnabled) speak(t.voiceOn);
                }}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 ${
                  voiceEnabled 
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-emerald-200' 
                    : 'bg-white text-gray-700 border border-gray-200 hover:shadow-lg'
                }`}
              >
                <Volume2 size={22} className={voiceEnabled ? 'animate-pulse' : ''} />
                <span className="font-medium text-lg">
                  {voiceEnabled ? t.voiceOn : t.voiceOff}
                </span>
              </button>
            </div>
          </FadeIn>

          <FadeIn delay={300}>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={22} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchDistrict}
                  className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 shadow-md transition-all duration-300"
                />
              </div>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-2">
            {filteredDistricts.map((d, idx) => (
              <FadeIn key={d.key} delay={400 + idx * 30}>
                <button
                  onClick={() => handleDistrictSelect(d.key)}
                  onMouseEnter={() => voiceEnabled && speak(d[selectedLanguage])}
                  className="bg-gradient-to-br from-white to-gray-50 hover:from-emerald-50 hover:to-emerald-100 border-2 border-gray-200 hover:border-emerald-400 rounded-lg p-4 text-left transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-102"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="text-emerald-700 flex-shrink-0" size={22} />
                    <div>
                      <span className="text-lg font-medium text-gray-800 block">{d.en}</span>
                      <span className="text-base text-gray-500 block">{d.hi}</span>
                    </div>
                  </div>
                </button>
              </FadeIn>
            ))}
          </div>

          {filteredDistricts.length === 0 && (
            <FadeIn>
              <div className="text-center py-12">
                <div className="text-5xl mb-3 text-gray-300">🔍</div>
                <p className="text-lg text-gray-400">{t.noDistrictFound}</p>
              </div>
            </FadeIn>
          )}
        </div>
      </div>
    );
  }

  if (currentStep === 'trends-view') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {infoModal && (
          <InfoModal
            title={infoModal.title}
            text={infoModal.text}
            onClose={() => setInfoModal(null)}
            lang={selectedLanguage}
          />
        )}
        
        <div className="sticky top-0 z-40 bg-white shadow-md border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentStep('data-view')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-300 transform hover:scale-110"
                  title={t.backToData}
                >
                  <Home size={22} className="text-gray-600" />
                </button>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-800">{t.yearlyProgress}</h1>
                  <div className="flex items-center gap-2 text-gray-500 text-base">
                    <MapPin size={16} />
                    <span className="font-medium">{getDistrictDisplayName(district)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled);
                  if (!voiceEnabled) speak(t.voiceOn);
                }}
                className={`p-2 rounded-lg transition-all duration-300 transform hover:scale-110 ${
                  voiceEnabled ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <Volume2 size={22} className={voiceEnabled ? 'animate-pulse' : ''} />
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
          {historicalData.length > 0 ? (
            <div className="space-y-4">
              {historicalData.slice().reverse().map((yearData, idx) => {
                const isCurrentYear = yearData.year === selectedYear;
                const personDays = yearData.personDays || yearData.person_days_generated || 0;
                const households = yearData.households || yearData.active_job_cards || 0;
                const maxPersonDays = Math.max(...historicalData.map(y => y.personDays || y.person_days_generated || 0));
                const barWidth = (personDays / (maxPersonDays || 1)) * 100;

                return (
                  <FadeIn key={yearData.year} delay={idx * 100}>
                    <div
                      className={`bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md p-6 border-2 transition-all duration-300 hover:shadow-lg ${
                        isCurrentYear ? 'border-emerald-400 shadow-emerald-100' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-left">
                          <div className="flex items-center gap-3 mb-1">
                            <span className={`p-2.5 rounded-lg shadow-sm ${isCurrentYear ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                              {isCurrentYear ? 
                                <BarChart2 size={22} className="text-emerald-700" /> : 
                                <Calendar size={22} className="text-gray-500" />
                              }
                            </span>
                            <div>
                              <h3 className="text-2xl font-semibold text-gray-800">{yearData.year}</h3>
                              {isCurrentYear && (
                                <span className="text-emerald-700 font-medium text-sm">{t.yearToDate}</span>
                              )}
                            </div>
                            <button
                              onClick={() => setInfoModal({ 
                                title: yearData.year, 
                                text: isCurrentYear ? t.infoYearToDate : t.infoFullYear 
                              })}
                              className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-all duration-300 transform hover:scale-110"
                            >
                              <Info size={16} />
                            </button>
                          </div>
                        </div>
                        <button 
                          className="text-right group"
                          onClick={() => voiceEnabled && speak(`${yearData.year}, ${formatNumber(personDays)} ${t.totalWorkDays}`)}
                        >
                          <p className="text-gray-500 text-sm mb-1">{t.totalWorkDays}</p>
                          <p className="text-3xl font-bold text-emerald-700 group-hover:scale-105 transition-transform inline-block">{formatNumber(personDays)}</p>
                        </button>
                      </div>

                      <div className="relative h-10 bg-emerald-100 rounded-full overflow-hidden mb-5 shadow-inner">
                        <div
                          style={{ width: `${barWidth}%`, transition: 'width 1s ease-out' }}
                          className={`absolute h-full flex items-center justify-end pr-3 ${
                            isCurrentYear ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                          }`}
                        >
                          {barWidth > 25 && (
                            <span className="text-white font-semibold text-xs animate-pulse">{Math.round(barWidth)}%</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 border-2 border-gray-200 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <Users size={20} className="text-gray-500" />
                            <button
                              onClick={() => setInfoModal({ title: t.activeWorkers, text: t.infoActiveWorkers })}
                              className="p-1 -mt-1 -mr-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-all duration-300 transform hover:scale-110"
                            >
                              <Info size={16} />
                            </button>
                          </div>
                          <button 
                            className="text-left w-full group"
                            onClick={() => voiceEnabled && speak(`${t.activeWorkers}, ${formatNumber(households)}`)}
                          >
                            <p className="text-gray-500 text-sm mb-1">{t.activeWorkers}</p>
                            <p className="text-xl font-bold text-gray-800 group-hover:scale-105 transition-transform inline-block">{formatNumber(households)}</p>
                          </button>
                        </div>
                        <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 border-2 border-gray-200 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <BarChart2 size={20} className="text-gray-500" />
                            <button
                              onClick={() => setInfoModal({ title: t.perHousehold, text: t.infoPerHousehold })}
                              className="p-1 -mt-1 -mr-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-all duration-300 transform hover:scale-110"
                            >
                              <Info size={16} />
                            </button>
                          </div>
                          <button 
                            className="text-left w-full group"
                            onClick={() => voiceEnabled && speak(`${t.perHousehold}, ${(personDays / Math.max(households, 1)).toFixed(1)} ${t.days}`)}
                          >
                            <p className="text-gray-500 text-sm mb-1">{t.perHousehold}</p>
                            <p className="text-xl font-bold text-gray-800 group-hover:scale-105 transition-transform inline-block">
                              {(personDays / Math.max(households, 1)).toFixed(1)} {t.days}
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          ) : (
            <FadeIn>
              <div className="bg-white rounded-xl shadow-md p-12 text-center border-2 border-gray-200">
                <BarChart2 size={48} className="text-gray-300 mb-4 mx-auto animate-pulse" />
                <p className="text-lg text-gray-500">{t.loadingHistorical}</p>
              </div>
            </FadeIn>
          )}

          {historicalData.length > 1 && (
            <FadeIn delay={200}>
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md p-6 border-2 border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp size={22} className="text-emerald-700" />
                  {t.progressSummary}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-emerald-50 to-white rounded-lg p-4 border-2 border-emerald-200 text-center shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="flex justify-center items-center gap-2 mb-2">
                      <TrendingUp size={24} className="text-emerald-700" />
                      <button
                        onClick={() => setInfoModal({ title: t.totalGrowth, text: t.infoTotalGrowth })}
                        className="p-1 rounded-lg text-gray-400 hover:bg-white transition-all duration-300 transform hover:scale-110"
                      >
                        <Info size={14} />
                      </button>
                    </div>
                    <p className="text-base text-gray-600 mb-1">{t.totalGrowth}</p>
                    <p className="text-sm text-gray-400 mb-2">({t.completeYears})</p>
                    <p className="text-3xl font-bold text-emerald-700">
                      {(() => {
                        const completeYears = historicalData.filter(y => y.year !== selectedYear);
                        if (completeYears.length < 2) return 'N/A';
                        
                        const oldest = completeYears[completeYears.length - 1];
                        const newest = completeYears[0];
                        const oldestDays = oldest.personDays || oldest.person_days_generated || 0;
                        const newestDays = newest.personDays || newest.person_days_generated || 0;
                        const growth = ((newestDays / Math.max(oldestDays, 1) - 1) * 100).toFixed(0);
                        
                        return `${growth > 0 ? '+' : ''}${growth}%`;
                      })()}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-4 border-2 border-blue-200 text-center shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="flex justify-center items-center gap-2 mb-2">
                      <Calendar size={24} className="text-blue-700" />
                      <button
                        onClick={() => setInfoModal({ title: t.yearsTracked, text: t.infoYearsTracked })}
                        className="p-1 rounded-lg text-gray-400 hover:bg-white transition-all duration-300 transform hover:scale-110"
                      >
                        <Info size={14} />
                      </button>
                    </div>
                    <p className="text-base text-gray-600 mb-1">{t.yearsTracked}</p>
                    <p className="text-3xl font-bold text-blue-700">{historicalData.length}</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-white rounded-lg p-4 border-2 border-amber-200 text-center shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="flex justify-center items-center gap-2 mb-2">
                      <CheckCircle size={24} className="text-amber-700" />
                      <button
                        onClick={() => setInfoModal({ title: t.bestYear, text: t.infoBestYear })}
                        className="p-1 rounded-lg text-gray-400 hover:bg-white transition-all duration-300 transform hover:scale-110"
                      >
                        <Info size={14} />
                      </button>
                    </div>
                    <p className="text-base text-gray-600 mb-1">{t.bestYear}</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {historicalData.length > 0 &&
                        historicalData.reduce((best, curr) => {
                          const currDays = curr.personDays || curr.person_days_generated || 0;
                          const bestDays = best.personDays || best.person_days_generated || 0;
                          return currDays > bestDays ? curr : best;
                        }).year
                      }
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          <FadeIn delay={300}>
            <button
              onClick={() => setCurrentStep('data-view')}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg shadow-md p-4 text-lg font-medium hover:from-emerald-700 hover:to-emerald-800 transition-all duration-300 transform hover:scale-102"
            >
              ← {t.backToData}
            </button>
          </FadeIn>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
      
      {infoModal && (
        <InfoModal
          title={infoModal.title}
          text={infoModal.text}
          onClose={() => setInfoModal(null)}
          lang={selectedLanguage}
        />
      )}
      
      <div className="sticky top-0 z-40 bg-white shadow-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentStep('district-select')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-300 transform hover:scale-110"
                title={t.changeDistrict}
              >
                <Home size={22} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-800">{t.appName} {t.performance}</h1>
                <div className="flex items-center gap-2 text-gray-500 text-base">
                  <MapPin size={16} />
                  <span className="font-medium">{getDistrictDisplayName(district)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled);
                  if (!voiceEnabled) speak(t.voiceOn);
                }}
                className={`p-2 rounded-lg transition-all duration-300 transform hover:scale-110 ${
                  voiceEnabled ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={t.voiceOff}
              >
                <Volume2 size={22} className={voiceEnabled ? 'animate-pulse' : ''} />
              </button>
              <button
                onClick={() => fetchDistrictData(district, true)}
                disabled={refreshing}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-300 disabled:opacity-50 text-gray-600 transform hover:scale-110"
                title={t.refresh}
              >
                <RefreshCw size={22} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowInfo(!showInfo)}
                className={`p-2 rounded-lg transition-all duration-300 transform hover:scale-110 ${
                  showInfo ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={t.whatIsMGNREGA}
              >
                <HelpCircle size={22} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showInfo && (
        <FadeIn>
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="bg-gradient-to-r from-white to-emerald-50 border-l-4 border-emerald-500 p-6 rounded-lg shadow-md">
              <h3 className="font-semibold text-xl mb-4 flex items-center gap-2">
                <Info size={22} className="text-emerald-700" />
                {t.whatIsMGNREGA}
              </h3>
              <div className="space-y-3 text-base text-gray-600 leading-relaxed">
                <p>
                  <strong>{t.appName}</strong> {t.mgnregaDesc}
                </p>
                <p>
                  💰 {selectedLanguage === 'en' 
                    ? `You can earn up to ₹${districtData?.avgWage || 280} per day.`
                    : `आपको प्रतिदिन ₹${districtData?.avgWage || 280} तक मिल सकते हैं।`}
                </p>
                <p>
                  📞 <strong>{selectedLanguage === 'en' ? 'Helpline:' : 'सहायता:'}</strong> {t.helplineDesc}
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {error && (
        <FadeIn>
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="bg-gradient-to-r from-red-50 to-white border-l-4 border-red-500 p-6 rounded-lg flex items-start gap-3 shadow-md">
              <AlertCircle className="text-red-600 flex-shrink-0" size={22} />
              <div>
                <p className="text-red-800 font-semibold text-lg mb-1">{error}</p>
                <p className="text-red-700 text-base">{t.tryAgain}</p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {!districtData && !loading && !error && (
        <FadeIn>
          <div className="max-w-6xl mx-auto px-4 py-12">
            <div className="bg-white rounded-xl shadow-md p-12 text-center border-2 border-gray-200">
              <BarChart2 size={48} className="text-gray-300 mb-6 mx-auto animate-pulse" />
              <h2 className="text-3xl font-semibold text-gray-800 mb-4">{t.noData}</h2>
              <p className="text-lg text-gray-500 mb-8">{t.noDataDistrict}</p>
              <button
                onClick={() => fetchDistrictData(district, true)}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-8 py-3 rounded-lg text-lg font-medium hover:from-emerald-700 hover:to-emerald-800 transition-all duration-300 shadow-md transform hover:scale-105"
              >
                <RefreshCw size={18} className="inline-block mr-2" />
                {t.refresh}
              </button>
            </div>
          </div>
        </FadeIn>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {districtData && (
          <>
            <FadeIn delay={0}>
              <button
                onClick={() => {
                  setCurrentStep('trends-view');
                  if (voiceEnabled) speak(t.yearlyProgress);
                }}
                className="w-full bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white rounded-xl shadow-lg p-7 hover:from-emerald-700 hover:via-emerald-800 hover:to-teal-800 transition-all duration-300 transform hover:scale-102 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                <div className="flex items-center justify-center gap-4 relative z-10">
                  <TrendingUp size={32} className="group-hover:scale-110 transition-transform duration-300" />
                  <div className="text-center">
                    <p className="text-2xl font-semibold">{t.viewTrends}</p>
                    <p className="text-emerald-100 text-base">{t.seeProgress}</p>
                  </div>
                  <BarChart2 size={32} className="group-hover:scale-110 transition-transform duration-300" />
                </div>
              </button>
            </FadeIn>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { title: t.totalJobCards, value: formatNumber(districtData?.totalJobCards), icon: Users, color: "text-blue-700", infoText: t.infoTotalJobCards, delay: 100 },
                { title: t.activeWorkers, value: formatNumber(districtData?.activeWorkers), icon: CheckCircle, color: "text-emerald-700", infoText: t.infoActiveWorkers, delay: 150 },
                { title: t.totalWorkDays, value: formatNumber(districtData?.personDaysGenerated), icon: Calendar, color: "text-purple-700", infoText: t.infoTotalWorkDays, delay: 200 },
                { title: t.perHousehold, value: `${districtData?.averageDaysPerHousehold} ${t.days}`, icon: Clock, color: "text-amber-700", infoText: t.infoPerHousehold, delay: 250 }
              ].map((card, idx) => (
                <FadeIn key={idx} delay={card.delay}>
                  <DataCard
                    title={card.title}
                    value={card.value}
                    icon={card.icon}
                    color={card.color}
                    onInfoClick={setInfoModal}
                    infoText={card.infoText}
                    speakText={`${card.title}, ${card.value}`}
                    voiceEnabled={voiceEnabled}
                    speak={speak}
                  />
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={300}>
              <div className="bg-gradient-to-br from-white to-pink-50 rounded-xl shadow-md border-2 border-pink-200 p-7">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <span className="p-3 bg-pink-100 rounded-lg shadow-sm">
                      <Users size={24} className="text-pink-700" />
                    </span>
                    <h3 className="text-xl font-semibold text-gray-800">{t.womenParticipation}</h3>
                  </div>
                  <button
                    onClick={() => setInfoModal({ title: t.womenParticipation, text: t.infoWomenParticipation })}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-white transition-all duration-300 transform hover:scale-110"
                    title="Info"
                  >
                    <Info size={18} />
                  </button>
                </div>
                <button 
                  className="w-full text-right mb-5 group"
                  onClick={() => speak(`${t.womenParticipation}, ${districtData?.womenParticipation} ${selectedLanguage === 'hi' ? 'प्रतिशत' : 'percent'}`)}
                >
                  <div className="text-5xl font-bold text-pink-700 group-hover:scale-105 transition-transform inline-block">{districtData?.womenParticipation}%</div>
                </button>
                <div className="relative h-12 bg-pink-100 rounded-full overflow-hidden shadow-inner">
                  <div
                    style={{ width: `${Math.min(districtData?.womenParticipation || 0, 100)}%`, transition: 'width 1s ease-out' }}
                    className="absolute h-full bg-gradient-to-r from-pink-500 to-pink-600 flex items-center justify-end pr-3"
                  >
                    {districtData?.womenParticipation > 50 && (
                      <span className="text-white font-semibold text-base animate-pulse">✨ {t.excellent}</span>
                    )}
                  </div>
                </div>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FadeIn delay={350}>
                <div className="bg-gradient-to-br from-white to-emerald-50 rounded-xl shadow-md p-7 border-2 border-emerald-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="p-3 bg-emerald-100 rounded-lg shadow-sm">
                      <CheckCircle size={28} className="text-emerald-700" />
                    </span>
                    <button
                      onClick={() => setInfoModal({ title: t.completedWorks, text: t.infoCompletedWorks })}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-white transition-all duration-300 transform hover:scale-110"
                      title="Info"
                    >
                      <Info size={18} />
                    </button>
                  </div>
                  <button 
                    className="text-left w-full group"
                    onClick={() => speak(`${t.completedWorks}, ${districtData?.completedWorks}`)}
                  >
                    <p className="text-lg text-gray-500 mb-1 font-medium">{t.completedWorks}</p>
                    <p className="text-4xl font-bold text-emerald-700 group-hover:scale-105 transition-transform inline-block">{districtData?.completedWorks}</p>
                  </button>
                </div>
              </FadeIn>

              <FadeIn delay={400}>
                <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-md p-7 border-2 border-blue-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="p-3 bg-blue-100 rounded-lg shadow-sm">
                      <Building size={28} className="text-blue-700" />
                    </span>
                    <button
                      onClick={() => setInfoModal({ title: t.ongoingWorks, text: t.infoOngoingWorks })}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-white transition-all duration-300 transform hover:scale-110"
                      title="Info"
                    >
                      <Info size={18} />
                    </button>
                  </div>
                  <button 
                    className="text-left w-full group"
                    onClick={() => speak(`${t.ongoingWorks}, ${districtData?.ongoingWorks}`)}
                  >
                    <p className="text-lg text-gray-500 mb-1 font-medium">{t.ongoingWorks}</p>
                    <p className="text-4xl font-bold text-blue-700 group-hover:scale-105 transition-transform inline-block">{districtData?.ongoingWorks}</p>
                  </button>
                </div>
              </FadeIn>
            </div>

            <FadeIn delay={450}>
              <div className="bg-gradient-to-br from-white to-emerald-50 rounded-xl shadow-md border-2 border-emerald-200 p-7">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="p-3 bg-emerald-100 rounded-lg shadow-sm">
                      <IndianRupee size={28} className="text-emerald-700" />
                    </span>
                    <h3 className="text-xl font-semibold text-gray-800">{t.wageInfo}</h3>
                  </div>
                  <button
                    onClick={() => setInfoModal({ title: t.wageInfo, text: `${t.infoPerDayWage} ${t.infoTotalExpenditure}` })}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-white transition-all duration-300 transform hover:scale-110"
                    title="Info"
                  >
                    <Info size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <button 
                    className="bg-gradient-to-br from-emerald-50 to-white rounded-lg p-6 border-2 border-emerald-200 text-left shadow-sm hover:shadow-md transition-all duration-300 group"
                    onClick={() => speak(`${t.perDayWage}, ${districtData?.avgWage} ${selectedLanguage === 'hi' ? 'रुपये' : 'rupees'}`)}
                  >
                    <p className="text-base text-gray-500 mb-1 font-medium">{t.perDayWage}</p>
                    <p className="text-4xl font-bold text-emerald-700 group-hover:scale-105 transition-transform inline-block">₹ {districtData?.avgWage}</p>
                  </button>
                  <button 
                    className="bg-gradient-to-br from-emerald-50 to-white rounded-lg p-6 border-2 border-emerald-200 text-left shadow-sm hover:shadow-md transition-all duration-300 group"
                    onClick={() => speak(`${t.totalExpenditure}, ${formatNumber(districtData?.expenditure)} ${selectedLanguage === 'hi' ? 'रुपये' : 'rupees'}`)}
                  >
                    <p className="text-base text-gray-500 mb-1 font-medium">{t.totalExpenditure}</p>
                    <p className="text-4xl font-bold text-emerald-700 group-hover:scale-105 transition-transform inline-block">₹ {formatNumber(districtData?.expenditure)}</p>
                  </button>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={500}>
              <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-md p-7 border-2 border-blue-200">
                <div className="flex items-center gap-3 mb-4">
                  <Phone size={24} className="text-blue-700" />
                  <h3 className="text-xl font-semibold text-gray-800">{t.needHelp}</h3>
                </div>
                <div className="space-y-3">
                  <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-6 border-2 border-blue-200 shadow-sm">
                    <p className="text-lg font-medium text-gray-600 mb-2">{t.helpline}</p>
                    <button 
                      className="w-full text-left group"
                      onClick={() => speak(t.helpline)}
                    >
                      <p className="text-4xl font-bold text-blue-700 group-hover:scale-105 transition-transform inline-block">1800-180-6127</p>
                    </button>
                  </div>
                  <p className="text-gray-500 text-base">
                    📞 {t.helplineTime}
                  </p>
                </div>
              </div>
            </FadeIn>
          </>
        )}

        <FadeIn delay={550}>
          <div className="text-center py-6 space-y-2">
            <p className="text-gray-500 text-base">
              📊 {t.dataSource}
            </p>
            <p className="text-sm text-gray-400">
              🔄 {t.lastUpdated} {new Date().toLocaleDateString(selectedLanguage === 'en' ? 'en-IN' : 'hi-IN')}
            </p>
          </div>
        </FadeIn>
      </div>
    </div>
  );
};

export default MGNREGADashboard;