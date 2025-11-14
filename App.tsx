import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import type { Message, Gender, Tone } from './types';
import { REGIONS } from './constants';
import { getWeatherAndRecommendation, getTextRecommendation, getImageRecommendation, generateOutfitImage, getRegionFromCoords } from './services/openaiService';

const initialMessage: Message = {
  id: 1,
  role: 'assistant',
  // FIX: Switched to double quotes to fix syntax error with inner single quotes.
  text: "안녕하세요! 저는 웨어리예요. '설정'에서 지역, 성별, 말투를 선택하시거나, 위치 정보 제공에 동의하시면 날씨에 딱 맞는 코디를 추천해드릴게요!"
};

// --- Tone-specific Message Helpers ---

const getWeatherPlaceholderMessage = (region: string, tone: Tone): string => {
  switch (tone) {
    case 'critical':
      return `${region} 날씨? 보는 중.`;
    case 'witty':
      return `오케이, ${region} 날씨 스캔 중! 찌리릿...⚡`;
    case 'friendly':
    default:
      return `${region} 날씨를 확인하고 있어요... 🌦️`;
  }
};

const getWeatherErrorMessage = (tone: Tone, error: string): string => {
  switch (tone) {
    case 'critical':
      return `날씨 보다가 에러남. (${error})`;
    case 'witty':
      return `날씨의 신이 노하셨나... 에러...😱 (${error})`;
    case 'friendly':
    default:
      return `날씨 확인 중 오류가 발생했어요: ${error}`;
  }
};

const getImageGenerationPlaceholderMessage = (tone: Tone): string => {
  switch (tone) {
    case 'critical':
      return '이미지 만드는 중. 재촉 마.';
    case 'witty':
      return '예술혼 불태우는 중... 잠시만. 🎨';
    case 'friendly':
    default:
      return '제안된 코디 이미지를 만들고 있어요... 🎨';
  }
};

const getImageGenerationSuccessMessage = (tone: Tone): string => {
  switch (tone) {
    case 'critical':
      return '자, 보던가.';
    case 'witty':
      return '훗, 이 몸이 좀 감각있지. 😎';
    case 'friendly':
    default:
      return '짠! 요청하신 코디 이미지예요. ✨';
  }
};

const getImageGenerationErrorMessage = (tone: Tone, error: string): string => {
  switch (tone) {
    case 'critical':
      return `이미지 만들다 에러남. 알아서 해. (${error})`;
    case 'witty':
      return `아놔, 내 예술혼이 거부 반응을... 🤯 에러: ${error}`;
    case 'friendly':
    default:
      return `이미지 생성 중 오류가 발생했어요: ${error}`;
  }
};

const getAnalysisPlaceholderMessage = (isImage: boolean, tone: Tone): string => {
    if (isImage) {
        switch (tone) {
            case 'critical':
                return '사진 보는 중. 평가해주지.';
            case 'witty':
                return '어디보자... 패션 감별 들어갑니다~ 🕵️';
            case 'friendly':
            default:
                return '사진을 분석하고 있어요... 📸';
        }
    } else {
        switch (tone) {
            case 'critical':
                return '...생각 중.';
            case 'witty':
                return '흐음... 기가 막힌 추천을 위한 빌드업 중... 🤔';
            case 'friendly':
            default:
                return '코디를 추천하고 있어요... ✍️';
        }
    }
};

const getAnalysisErrorMessage = (isImage: boolean, tone: Tone, error: string): string => {
    if (isImage) {
        switch (tone) {
            case 'critical':
                return `사진 보다 에러남. (${error})`;
            case 'witty':
                return `이런, 사진이 너무 눈부셨나... 에러! ✨ (${error})`;
            case 'friendly':
            default:
                return `이미지 처리 중 오류가 발생했어요: ${error}`;
        }
    } else {
        switch (tone) {
            case 'critical':
                return `추천하다 에러남. (${error})`;
            case 'witty':
                return `뇌세포 과부하! 추천 엔진 터짐... 🤯 (${error})`;
            case 'friendly':
            default:
                return `오류가 발생했어요: ${error}`;
        }
    }
};


interface SettingsModalProps {
  currentRegion: string;
  currentGender: Gender;
  currentTone: Tone;
  onClose: () => void;
  onApply: (settings: { region: string; gender: Gender; tone: Tone }) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ currentRegion, currentGender, currentTone, onClose, onApply }) => {
  const [selectedRegion, setSelectedRegion] = useState(currentRegion);
  const [selectedGender, setSelectedGender] = useState(currentGender);
  const [selectedTone, setSelectedTone] = useState(currentTone);
  const [isLocating, setIsLocating] = useState(false);

  const genderOptions: { value: Gender, label: string }[] = [
    { value: 'male', label: '남성' },
    { value: 'female', label: '여성' },
    { value: 'unisex', label: '상관없음' },
  ];

  const toneOptions: { value: Tone, label: string }[] = [
    { value: 'critical', label: '까칠한 친구' },
    { value: 'witty', label: '쾌활한 친구' },
    { value: 'friendly', label: '친절한 튜터' },
  ];

  const handleApply = () => {
    onApply({ region: selectedRegion, gender: selectedGender, tone: selectedTone });
  };

  const handleGetCurrentLocation = useCallback(() => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const region = await getRegionFromCoords(latitude, longitude);
          if (region) {
            setSelectedRegion(region);
          } else {
            alert('위치에서 지역을 찾을 수 없습니다. 수동으로 선택해주세요.');
          }
        } catch (error) {
          console.error('Error getting region:', error);
          alert('위치 확인 중 오류가 발생했습니다.');
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('위치 정보를 가져올 수 없습니다. 브라우저 설정을 확인해주세요.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">설정</h2>
            <p className="text-sm text-gray-500">지역, 성별, 말투를 선택해주세요.</p>
          </div>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">닫기</button>
        </div>
        
        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-700 mb-3">말투</h3>
          <div className="grid grid-cols-3 gap-3">
            {toneOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedTone(value)}
                className={`py-3 rounded-xl border transition-all duration-200 ${
                  selectedTone === value
                    ? 'ring-2 ring-purple-500 bg-purple-50 text-purple-700 font-semibold shadow-md'
                    : 'bg-gray-50 hover:bg-gray-100 hover:shadow-sm'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-700 mb-3">성별</h3>
          <div className="grid grid-cols-3 gap-3">
            {genderOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedGender(value)}
                className={`py-3 rounded-xl border transition-all duration-200 ${
                  selectedGender === value
                    ? 'ring-2 ring-purple-500 bg-purple-50 text-purple-700 font-semibold shadow-md'
                    : 'bg-gray-50 hover:bg-gray-100 hover:shadow-sm'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-semibold text-gray-700">지역</h3>
            <button
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLocating ? (
                <>
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>위치 확인 중...</span>
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>현재 위치로 설정</span>
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRegion(r)}
                className={`py-3 rounded-xl border transition-all duration-200 ${
                  selectedRegion === r
                    ? 'ring-2 ring-purple-500 bg-purple-50 text-purple-700 font-semibold shadow-md'
                    : 'bg-gray-50 hover:bg-gray-100 hover:shadow-sm'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-all">취소</button>
          <button onClick={handleApply} className="px-5 py-2 rounded-xl bg-purple-600 text-white font-medium shadow-lg hover:bg-purple-700 transition-all disabled:opacity-50" disabled={!selectedRegion}>적용</button>
        </div>
        
        <p className="mt-4 text-xs text-gray-500 text-center">지역을 선택해야 추천을 시작할 수 있습니다.</p>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [region, setRegion] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [tone, setTone] = useState<Tone>('friendly');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [lastOutfitSuggestion, setLastOutfitSuggestion] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(initialMessage.id); // Start counter from initial message ID

  useEffect(() => {
    // Use a timeout to ensure the DOM has rendered the new message before scrolling.
    // This makes scrolling more reliable, especially for placeholder messages.
    const scrollTimeout = setTimeout(() => {
      if (chatListRef.current) {
        chatListRef.current.scrollTo({ top: chatListRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 100); // A small delay is often sufficient.
  
    return () => clearTimeout(scrollTimeout); // Cleanup on component unmount or before next effect runs.
  }, [messages]);

  const getNewMessageId = useCallback(() => {
    messageIdCounter.current += 1;
    return messageIdCounter.current;
  }, []);

  const addMessage = useCallback((role: 'user' | 'assistant', text: string, image?: string, generatedImage?: string, loadingImage?: boolean): number => {
    const newId = getNewMessageId();
    const newMessage: Message = { id: newId, role, text, image, generatedImage, loadingImage };
    setMessages(prev => [...prev, newMessage]);
    return newId;
  }, [getNewMessageId]);

  const handleSettingsApply = useCallback(async ({ region: newRegion, gender: newGender, tone: newTone }: { region: string, gender: Gender, tone: Tone }) => {
    setSettingsOpen(false);

    if (newRegion === region && newGender === gender && newTone === tone) {
      return;
    }

    setRegion(newRegion);
    setGender(newGender);
    setTone(newTone);

    if (!newRegion) return;

    const genderText = newGender === 'male' ? '남성' : newGender === 'female' ? '여성' : newGender === 'unisex' ? '상관없음' : '';
    const toneText = newTone === 'critical' ? '까칠한 친구' : newTone === 'witty' ? '쾌활한 친구' : '친절한 튜터';
    const userMessage = `설정 변경: ${newRegion}` + (genderText ? `, ${genderText}` : '') + `, ${toneText}`;
    addMessage('user', userMessage);

    const placeholderId = addMessage('assistant', getWeatherPlaceholderMessage(newRegion, newTone));
    setQuickReplies([]);
    
    try {
      const data = await getWeatherAndRecommendation(newRegion, newGender, newTone);
      const weatherText = `${newRegion}의 현재 날씨는 ${data.summary} / 현재 ${data.temp}°C (최저 ${data.minTemp}°C / 최고 ${data.maxTemp}°C) 예요.`;
      const combinedText = `${weatherText}\n\n${data.suggestion}`;
      setMessages(prev => prev.map(m => m.id === placeholderId ? {...m, text: combinedText, generatedImage: undefined } : m));
      setQuickReplies(['코디 이미지 보여줘', '활동량 많은 날엔?', '저녁 약속엔 뭐 입지?']);
    } catch (e) {
      const error = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
      setMessages(prev => prev.map(m => m.id === placeholderId ? {...m, text: getWeatherErrorMessage(newTone, error)} : m));
      setQuickReplies(['날씨 알려줘']);
    }
  }, [addMessage, region, gender, tone]);

  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    
    const isImageRequest = ['코디 이미지 보여줘', '이 코디 이미지로 보여줘', '제안된 코디 이미지로 보여줘'].includes(text);

    if (isImageRequest && lastOutfitSuggestion) {
      addMessage('user', text);
      setInput('');
      setQuickReplies([]);
      setIsLoading(true);
      
      const placeholderId = addMessage('assistant', getImageGenerationPlaceholderMessage(tone), undefined, undefined, true);
      const currentSuggestion = lastOutfitSuggestion;
      setLastOutfitSuggestion('');

      try {
        const imageUrl = await generateOutfitImage(currentSuggestion, gender);
        setMessages(prev => prev.map(m => m.id === placeholderId ? {...m, text: getImageGenerationSuccessMessage(tone), generatedImage: imageUrl ?? undefined, loadingImage: false } : m));
      } catch (e) {
        const error = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
        setMessages(prev => prev.map(m => m.id === placeholderId ? {...m, text: getImageGenerationErrorMessage(tone, error), loadingImage: false} : m));
      } finally {
        setIsLoading(false);
      }
      return;
    }


    if ((!text && !imageFile) || isLoading) return;

    if (imageFile) {
      const imageUrl = URL.createObjectURL(imageFile);
      addMessage('user', '', imageUrl);
    }
    if (text) {
      addMessage('user', text);
    }

    setInput('');
    setQuickReplies([]);
    setIsLoading(true);

    const currentImageFile = imageFile;
    setImageFile(null);
    if(fileInputRef.current) fileInputRef.current.value = "";

    const placeholderText = getAnalysisPlaceholderMessage(!!currentImageFile, tone);
    const placeholderId = addMessage('assistant', placeholderText);

    try {
      if (currentImageFile) {
        const data = await getImageRecommendation(currentImageFile, text, region, gender, tone);
        
        setMessages(prev => prev.map(m => m.id === placeholderId ? {...m, text: data.analysis } : m));
        
        setTimeout(() => {
            addMessage('assistant', data.suggestion);
            setLastOutfitSuggestion(data.suggestion);
        }, 500);

        setQuickReplies(data.quickReplies);

      } else {
        const data = await getTextRecommendation(text, region, gender, tone);
        setMessages(prev => prev.map(m => m.id === placeholderId ? {...m, text: data.advice, generatedImage: undefined } : m));
        setLastOutfitSuggestion(data.advice);
        setQuickReplies(data.quickReplies);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
      const errorMessage = getAnalysisErrorMessage(!!currentImageFile, tone, error);
      setMessages(prev => prev.map(m => m.id === placeholderId ? {...m, text: errorMessage } : m));
    } finally {
      setIsLoading(false);
    }
  }, [input, imageFile, isLoading, region, gender, tone, addMessage, lastOutfitSuggestion]);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
  }, []);

  const toneMap: Record<Tone, string> = {
    'critical': '까칠한 친구',
    'witty': '쾌활한 친구',
    'friendly': '친절한 튜터',
    '': '',
  };

  const settingsDisplayText = [
    region ? `지역: ${region}` : '지역 미설정',
    gender ? `성별: ${gender === 'male' ? '남성' : gender === 'female' ? '여성' : '상관없음'}` : '',
    tone ? `말투: ${toneMap[tone]}`: ''
  ].filter(Boolean).join(' | ');

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-100 p-2 sm:p-4">
      <div className="flex flex-col w-full h-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden bg-white/80 backdrop-blur-lg border border-gray-200">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">W</div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">웨어리</h1>
              <p className="text-sm text-gray-500">나만의 AI 코디네이터</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-600 hidden sm:block">{settingsDisplayText}</div>
            <button onClick={() => setSettingsOpen(true)} className="px-4 py-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 hover:shadow-md text-sm font-medium transition-all">설정</button>
            <button onClick={() => { setMessages([initialMessage]); setInput(''); setQuickReplies([]); setRegion(''); setGender(''); setTone('friendly'); setLastOutfitSuggestion('') }} className="px-4 py-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 hover:shadow-md text-sm font-medium transition-all">초기화</button>
          </div>
        </header>

        {/* Chat Area */}
        <main ref={chatListRef} className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-white/50 to-transparent">
          <div className="flex flex-col gap-5">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`
                  ${(m.image || m.generatedImage || m.loadingImage) && !m.text ? 'p-2 w-fit' : 'p-4'}
                  ${m.role === 'user' ? 'max-w-[85%]' : 'max-w-[85%] md:max-w-[75%]'}
                  rounded-2xl
                  ${ m.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-br-lg'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-lg'
                  } shadow-md`}>
                  {m.loadingImage && (
                    <div className="w-full aspect-square bg-gray-200 rounded-lg animate-pulse flex items-center justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                  )}
                  {m.image && <img src={m.image} alt="uploaded content" className="w-40 h-auto rounded-lg object-cover" />}
                  {m.generatedImage && <img src={m.generatedImage} alt="AI generated outfit" className={`w-full h-auto rounded-lg object-cover ${m.text ? 'mb-3' : ''}`} />}
                  {m.text && <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
                </div>
              </div>
            ))}
            {isLoading && !messages[messages.length-1].loadingImage && (
              <div className="flex items-end gap-2 justify-start">
                  <div className="p-4 max-w-[85%] md:max-w-[75%] rounded-2xl bg-white border border-gray-200 text-gray-800 rounded-bl-lg shadow-md">
                      <div className="flex items-center gap-2 text-gray-500">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-75"></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-150"></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-300"></div>
                      </div>
                  </div>
              </div>
            )}
          </div>
        </main>

        {/* Quick Replies & Composer */}
        <footer className="shrink-0">
          {quickReplies.length > 0 && !isLoading && (
            <div className="px-6 py-3 border-t border-gray-200/80 bg-white/50 flex gap-2 flex-wrap">
              {quickReplies.map((q, i) => (
                <button key={i} onClick={() => handleSend(q)} className="px-4 py-2 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-sm hover:bg-purple-100 hover:shadow-sm transition-all">{q}</button>
              ))}
            </div>
          )}
          {imageFile && (
            <div className="px-6 pt-4 border-t border-gray-200/80 bg-white/50">
              <div className="relative inline-block bg-gray-100 p-2 rounded-lg">
                <img src={URL.createObjectURL(imageFile)} alt="Preview" className="h-20 w-20 rounded-md object-cover" />
                <button
                  onClick={() => {
                    setImageFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute -top-2 -right-2 bg-gray-600 text-white rounded-full p-1 leading-none shadow-md hover:bg-red-500 transition-colors"
                  aria-label="Remove image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          )}
          <div className="px-6 py-4 border-t border-gray-200/80 bg-white/80">
            <div className="flex gap-3 items-end">
              <label className="cursor-pointer p-3 rounded-full hover:bg-gray-100 transition-colors">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isLoading} />
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </label>
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="오늘 뭐 입을지 물어보세요..."
                className="w-full resize-none p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={isLoading}
              />
              <button 
                onClick={() => handleSend()} 
                disabled={isLoading || (!input && !imageFile)} 
                className="p-3 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </footer>
      </div>
      {settingsOpen && <SettingsModal currentRegion={region} currentGender={gender} currentTone={tone} onClose={() => setSettingsOpen(false)} onApply={handleSettingsApply} />}
    </div>
  );
};

export default App;