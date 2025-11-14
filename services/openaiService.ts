import OpenAI from 'openai';
import type { Gender, Tone } from '../types';
import { REGIONS } from '../constants';

const API_KEY = import.meta.env.OPENAI_API_KEY || '';

if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
  console.warn('OpenAI API key not set. Please set OPENAI_API_KEY in .env.local');
}

const openai = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, API calls should be made from a backend
});

// Temperature-based clothing guide
const temperatureClothingGuide = `
<기온별 옷차림 가이드>
- 28°C 이상: 민소매, 반팔, 반바지, 린넨 옷 등 시원한 여름 옷차림.
- 23°C ~ 27°C: 반팔, 얇은 셔츠, 반바지, 면바지. 쾌적함을 유지하는 것이 중요.
- 20°C ~ 22°C: 얇은 가디건이나 긴팔 티셔츠, 면바지, 청바지. 봄, 가을 간절기 옷차림.
- 17°C ~ 19°C: 니트, 가디건, 후드티, 맨투맨, 청바지, 슬랙스. 다양한 스타일링이 가능한 온도.
- 12°C ~ 16°C: 자켓, 가디건, 야상. 아침저녁으로 쌀쌀하므로 겉옷 필수. 스타킹이나 니트 활용.
- 9°C ~ 11°C: 자켓, 트렌치코트, 니트, 청바지. 꽤 쌀쌀하므로 여러 겹 레이어드 추천.
- 5°C ~ 8°C: 코트, 가죽자켓, 히트텍, 니트, 레깅스. 겨울 옷차림 시작.
- 4°C 이하: 패딩, 두꺼운 코트, 목도리, 기모 제품 등 방한에 집중한 옷차림.
`;

// Regional fashion style context
const regionalStyleContext = `
  <지역별 패션 스타일 가이드>
  - 서울: 트렌디하고 미니멀한 스타일. 시크한 도시 감성.
  - 부산: 자유분방하고 캐주얼한 스타일. 해변과 어울리는 편안함.
  - 대구: 과감하고 패셔너블함. 더운 날씨 영향으로 시원하고 개성 있는 옷차림.
  - 광주: 예술적이고 독창적인 스타일.
  - 제주: 자연 친화적이고 실용적인 리조트 룩.
  - 인천: 국제공항과 항구도시 특성상 실용적이면서도 국제적인 감각이 섞인 스타일.
  - 대전: 교통의 중심지이자 연구 도시로, 단정하고 지적인 캐주얼 스타일.
  - 울산: 산업 도시 특성상 활동적이고 실용적인 워크웨어 스타일.
  - 세종: 행정 중심 신도시로, 깔끔하고 현대적인 비즈니스 캐주얼.
  - 경기: 서울 근교의 특성을 반영해, 트렌디하면서도 편안한 '꾸안꾸' 스타일.
  - 강원: 산과 자연의 영향으로 기능성과 스타일을 겸비한 고프코어 및 아웃도어 룩.
  - 충청(충북/충남): 온화하고 무난한 지역 특성을 반영한 편안하고 실용적인 스타일.
  - 전라(전북/전남): 예향의 도시답게, 여유롭고 멋스러운 스타일.
  - 경상(경북/경남): 지역적 특색이 강하며, 활동적이면서도 보수적인 면이 공존하는 스타일.
  이 가이드를 바탕으로 지역에 맞는 미묘한 스타일 차이를 조언에 녹여줘.
`;

// Helper to get color preference text
const getColorPromptText = (colors: string[]): string => {
  if (colors.length > 0) {
    return `\n<사용자 선호 색상>\n- 사용자는 다음 색상들을 특히 선호해: [${colors.join(', ')}].\n- 추천하는 코디에 이 색상들을 조화롭게 꼭 포함시켜줘.\n`;
  }
  return '';
};

// Helper to get physical info text
const getPhysicalInfoPromptText = (height: string, weight: string): string => {
  if (height && weight) {
    return `\n<사용자 신체 정보>\n- 키: ${height}cm\n- 몸무게: ${weight}kg\n이 정보를 참고해서 체형에 맞는 핏을 추천해줘.\n`;
  }
  if (height) {
    return `\n<사용자 신체 정보>\n- 키: ${height}cm\n`;
  }
  if (weight) {
    return `\n<사용자 신체 정보>\n- 몸무게: ${weight}kg\n`;
  }
  return '';
};

interface WeatherData {
  summary: string;
  temp: number;
  minTemp: number;
  maxTemp: number;
  suggestion: string;
}

interface TextRecommendation {
  advice: string;
  quickReplies: string[];
}

interface ImageRecommendation {
  analysis: string;
  suggestion: string;
  quickReplies: string[];
}

// Helper to get tone-specific prompt suffix
const getTonePrompt = (tone: Tone): string => {
  switch (tone) {
    case 'critical':
      return '말투는 까칠하고 퉁명스럽게. 짧고 직설적으로 말해. 예: "그냥 이거 입어.", "날씨? 추워."';
    case 'witty':
      return '말투는 쾌활하고 재치있게. 이모지를 적절히 사용하고 유머러스하게. 예: "오케이~ 내 감각을 믿어봐! ✨", "찌리릿... 추천 들어갑니다! ⚡"';
    case 'friendly':
    default:
      return '말투는 친절하고 따뜻하게. 자세히 설명해주고 이모지를 적절히 사용. 예: "오늘 날씨를 고려하면 이런 옷차림이 좋을 것 같아요! 😊"';
  }
};

// Get region name from GPS coordinates using OpenAI
export async function getRegionFromCoords(lat: number, lon: number): Promise<string | null> {
  try {
    const prompt = `대한민국 위도 ${lat}, 경도 ${lon}에 해당하는 지역명을 다음 리스트에서 하나만 골라줘.
[${REGIONS.join(', ')}]
다른 말은 절대 하지 말고, 리스트에 있는 지역명 하나만 정확히 말해줘.
예시: 서울`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const region = completion.choices[0]?.message?.content?.trim() || '';

    if (REGIONS.includes(region)) {
      return region;
    }
    return null;
  } catch (error) {
    console.error('Error getting region from coordinates:', error);
    return null;
  }
}

// Region name mapping for weather API
const REGION_NAMES: { [key: string]: string } = {
  '서울': 'Seoul',
  '부산': 'Busan',
  '대구': 'Daegu',
  '인천': 'Incheon',
  '광주': 'Gwangju',
  '대전': 'Daejeon',
  '울산': 'Ulsan',
  '세종': 'Sejong',
  '경기': 'Suwon',
  '강원': 'Chuncheon',
  '충북': 'Cheongju',
  '충남': 'Hongseong',
  '전북': 'Jeonju',
  '전남': 'Mokpo',
  '경북': 'Andong',
  '경남': 'Changwon',
  '제주': 'Jeju',
};

// Get weather data using wttr.in API (simple and reliable)
async function getKMAWeatherData(region: string): Promise<{ temp: number; minTemp: number; maxTemp: number; summary: string; description: string }> {
  try {
    const cityName = REGION_NAMES[region] || 'Seoul';

    console.log(`[Weather API] Fetching weather for ${region} (${cityName})...`);

    // wttr.in provides accurate weather data in JSON format
    const url = `https://wttr.in/${cityName}?format=j1&lang=ko`;

    const response = await fetch(url);
    const data = await response.json();

    console.log(`[Weather API] Weather data received for ${region}`);

    // Extract current weather
    const current = data.current_condition[0];
    const today = data.weather[0];

    const temp = parseInt(current.temp_C);
    const minTemp = parseInt(today.mintempC);
    const maxTemp = parseInt(today.maxtempC);

    // Determine Korean weather description
    const weatherCode = parseInt(current.weatherCode);
    let summary = '맑음';

    // wttr.in weather codes
    if (weatherCode >= 200 && weatherCode < 300) {
      summary = '뇌우';
    } else if (weatherCode >= 300 && weatherCode < 400) {
      summary = '이슬비';
    } else if (weatherCode >= 500 && weatherCode < 600) {
      summary = '비';
    } else if (weatherCode >= 600 && weatherCode < 700) {
      summary = '눈';
    } else if (weatherCode >= 700 && weatherCode < 800) {
      summary = '안개';
    } else if (weatherCode === 800) {
      summary = '맑음';
    } else if (weatherCode === 801 || weatherCode === 802) {
      summary = '구름 조금';
    } else if (weatherCode === 803) {
      summary = '구름 많음';
    } else if (weatherCode === 804) {
      summary = '흐림';
    } else {
      // Use Korean description from API
      const korDesc = current.lang_ko?.[0]?.value || current.weatherDesc?.[0]?.value || '맑음';
      summary = korDesc;
    }

    const description = `${region} 지역의 날씨는 ${summary}이며, 기온은 ${temp}도입니다.`;

    console.log(`[Weather API] ✅ ${region}: ${temp}°C (${minTemp}°C ~ ${maxTemp}°C), ${summary}`);

    return {
      temp,
      minTemp,
      maxTemp,
      summary,
      description
    };
  } catch (error) {
    console.error('[Weather API] ❌ Error fetching weather:', error);
    return getFallbackWeatherData(region);
  }
}

// Fallback weather data generator (used when KMA API fails)
const getFallbackWeatherData = (region: string): { temp: number; minTemp: number; maxTemp: number; summary: string; description: string } => {
  const now = new Date();
  const month = now.getMonth() + 1;

  let baseTemp = 20;
  let tempVariation = 5;

  if (month >= 12 || month <= 2) { // Winter
    baseTemp = 0;
    tempVariation = 8;
  } else if (month >= 3 && month <= 5) { // Spring
    baseTemp = 15;
    tempVariation = 8;
  } else if (month >= 6 && month <= 8) { // Summer
    baseTemp = 28;
    tempVariation = 5;
  } else { // Fall
    baseTemp = 18;
    tempVariation = 7;
  }

  const temp = Math.round(baseTemp + (Math.random() * tempVariation - tempVariation / 2));
  const minTemp = temp - Math.round(Math.random() * 3 + 2);
  const maxTemp = temp + Math.round(Math.random() * 3 + 2);

  const conditions = ['맑음', '구름 조금', '구름 많음', '흐림', '비', '눈'];
  const weights = temp < 5 ? [2, 2, 3, 3, 1, 2] : temp > 25 ? [5, 3, 2, 1, 1, 0] : [3, 3, 3, 2, 1, 0];

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  let summaryIndex = 0;

  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      summaryIndex = i;
      break;
    }
  }

  const summary = conditions[summaryIndex];
  const description = `${region} 지역의 날씨는 ${summary}이며, 기온은 ${temp}도입니다.`;

  return { temp, minTemp, maxTemp, summary, description };
};

export async function getWeatherAndRecommendation(
  region: string,
  gender: Gender,
  tone: Tone,
  colors: string[],
  height: string,
  weight: string
): Promise<WeatherData> {
  try {
    // Get weather data from Korea Meteorological Administration API
    const weather = await getKMAWeatherData(region);

    // Generate outfit recommendation using OpenAI
    const genderText = gender === 'male' ? '남성' : gender === 'female' ? '여성' : '남녀 공용';
    const toneInstruction = getTonePrompt(tone);

    const prompt = `당신은 패션 코디네이터입니다. 다음 날씨 정보를 바탕으로 ${genderText}을 위한 옷차림을 추천해주세요.

지역: ${region}
날씨: ${weather.summary}
현재 기온: ${weather.temp}°C
최저/최고: ${weather.minTemp}°C / ${weather.maxTemp}°C
${getPhysicalInfoPromptText(height, weight)}
${regionalStyleContext}
${getColorPromptText(colors)}
${temperatureClothingGuide}

다음 스타일로 답변해주세요:
${toneInstruction}

구체적인 아이템들을 언급하면서 2-3문장으로 추천해주세요. 날씨와 기온, 지역의 패션 스타일, 그리고 사용자의 선호를 고려한 실용적인 조언을 해주세요.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const suggestion = completion.choices[0]?.message?.content || '';

    return {
      summary: weather.summary,
      temp: weather.temp,
      minTemp: weather.minTemp,
      maxTemp: weather.maxTemp,
      suggestion
    };
  } catch (error) {
    console.error('Error in getWeatherAndRecommendation:', error);
    throw new Error('날씨 정보를 가져오는데 실패했습니다.');
  }
}

export async function getTextRecommendation(
  text: string,
  region: string,
  gender: Gender,
  tone: Tone,
  colors: string[],
  height: string,
  weight: string
): Promise<TextRecommendation> {
  try {
    const genderText = gender === 'male' ? '남성' : gender === 'female' ? '여성' : '남녀 공용';
    const toneInstruction = getTonePrompt(tone);

    // Get current weather for context
    const weather = await getKMAWeatherData(region);

    const prompt = `당신은 패션 코디네이터입니다. 사용자의 질문에 답변해주세요.

사용자 정보:
- 지역: ${region}
- 성별: ${genderText}
- 현재 날씨: ${weather.summary}, ${weather.temp}°C
${getPhysicalInfoPromptText(height, weight)}
사용자 질문: ${text}

${regionalStyleContext}
${getColorPromptText(colors)}
${temperatureClothingGuide}

다음 스타일로 답변해주세요:
${toneInstruction}

구체적인 옷 아이템과 조합을 언급하면서 답변해주세요. 지역의 패션 스타일과 사용자의 선호를 고려해주세요.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const advice = completion.choices[0]?.message?.content || '';

    // Generate contextual quick replies
    const quickReplies = [
      '이 코디 이미지로 보여줘',
      '더 캐주얼하게',
      '조금 더 격식있게'
    ];

    return {
      advice,
      quickReplies
    };
  } catch (error) {
    console.error('Error in getTextRecommendation:', error);
    throw new Error('추천을 생성하는데 실패했습니다.');
  }
}

export async function getImageRecommendation(
  file: File,
  text: string,
  region: string,
  gender: Gender,
  tone: Tone,
  colors: string[],
  height: string,
  weight: string
): Promise<ImageRecommendation> {
  try {
    const genderText = gender === 'male' ? '남성' : gender === 'female' ? '여성' : '남녀 공용';
    const toneInstruction = getTonePrompt(tone);

    // Convert file to base64 data URL
    const base64DataUrl = await fileToDataUrl(file);

    const weather = await getKMAWeatherData(region);

    const analysisPrompt = `당신은 패션 전문가입니다. 이 사진을 분석하고 평가해주세요.

다음 스타일로 답변해주세요:
${toneInstruction}

사진 속 옷차림에 대해 2-3문장으로 분석하고 간단한 평가를 해주세요.${text ? `\n\n추가 질문: ${text}` : ''}`;

    // Analyze the image using GPT-4 Vision
    const analysisCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt },
            {
              type: 'image_url',
              image_url: {
                url: base64DataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.7,
    });

    const analysis = analysisCompletion.choices[0]?.message?.content || '';

    // Generate improvement suggestions
    const suggestionPrompt = `당신은 패션 코디네이터입니다. 앞서 분석한 옷차림을 개선하거나 대안을 제시해주세요.

사용자 정보:
- 지역: ${region}
- 성별: ${genderText}
- 현재 날씨: ${weather.summary}, ${weather.temp}°C
${getPhysicalInfoPromptText(height, weight)}
${regionalStyleContext}
${getColorPromptText(colors)}
${temperatureClothingGuide}

다음 스타일로 답변해주세요:
${toneInstruction}

이전 분석: ${analysis}

개선 방안이나 대안 코디를 구체적인 아이템 언급과 함께 2-3문장으로 제안해주세요. 사용자의 선호 색상과 체형을 고려해주세요.`;

    const suggestionCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: suggestionPrompt }],
      temperature: 0.7,
    });

    const suggestion = suggestionCompletion.choices[0]?.message?.content || '';

    const quickReplies = [
      '제안된 코디 이미지로 보여줘',
      '좀 더 단순하게',
      '계절감 더 살려줘'
    ];

    return {
      analysis,
      suggestion,
      quickReplies
    };
  } catch (error) {
    console.error('Error in getImageRecommendation:', error);
    throw new Error('이미지 분석에 실패했습니다.');
  }
}

export async function generateOutfitImage(
  suggestion: string,
  gender: Gender,
  height?: string,
  weight?: string,
  profileImage?: string | null
): Promise<string | null> {
  try {
    const genderText = gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'unisex';

    // Build body type description based on height and weight
    let bodyTypeDescription = '';
    if (height && weight) {
      const heightNum = parseInt(height);
      const weightNum = parseInt(weight);
      const bmi = weightNum / ((heightNum / 100) ** 2);

      let bodyType = 'average build';
      if (bmi < 18.5) {
        bodyType = 'slim, slender build';
      } else if (bmi >= 18.5 && bmi < 23) {
        bodyType = 'fit, athletic build';
      } else if (bmi >= 23 && bmi < 25) {
        bodyType = 'average, healthy build';
      } else if (bmi >= 25 && bmi < 30) {
        bodyType = 'sturdy, stocky build';
      } else {
        bodyType = 'plus-size, curvy build';
      }

      bodyTypeDescription = `The model should have a ${bodyType}, approximately ${height}cm tall. `;
    }

    // Face description if profile image exists
    let faceDescription = '';
    if (profileImage) {
      faceDescription = 'The model should have Korean facial features with a natural, friendly expression. ';
    }

    // Create a detailed prompt for image generation with a Korean person wearing the outfit
    const prompt = `A professional fashion photograph of a ${genderText} Korean model wearing the outfit, full body shot. Style: modern Korean fashion street style.

${bodyTypeDescription}${faceDescription}

Outfit description: ${suggestion}

Requirements:
- A real Korean person wearing the complete outfit
- East Asian/Korean facial features and appearance
- Full body shot showing the entire outfit from head to toe
- Clean white or minimal studio background
- Professional fashion photography style
- Modern and trendy Korean street fashion aesthetic
- Model standing in a natural, casual pose
- Well-lit, high quality studio lighting
- The outfit should be clearly visible and well-fitted to the model
- Focus on showing how the outfit looks when worn on a Korean model
- Stylish and fashionable presentation
- Natural Korean beauty standards`;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = response.data[0]?.url;
    if (imageUrl) {
      return imageUrl;
    }

    return null;
  } catch (error) {
    console.error('Error in generateOutfitImage:', error);
    // If image generation fails, return null instead of throwing
    // This allows the app to continue functioning
    return null;
  }
}

// Helper function to convert File to data URL
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Generate outfit from liked images - extracts actual clothing items and combines them
export async function generateOutfitFromLikedImages(
  images: string[],
  region: string,
  gender: Gender,
  tone: Tone,
  colors: string[],
  height: string,
  weight: string,
  profileImage?: string | null
): Promise<{ imageUrl: string | null; suggestion: string }> {
  if (images.length === 0) {
    throw new Error("No images provided for recommendation.");
  }

  const genderText = gender === 'male' ? '남성' : gender === 'female' ? '여성' : '남녀 공용';
  const toneInstruction = getTonePrompt(tone);

  // Step 1: Extract specific clothing items from each image
  const messages: any[] = [
    {
      role: 'user',
      content: [
        ...images.map(img => ({
          type: 'image_url',
          image_url: { url: img }
        })),
        {
          type: 'text',
          text: `당신은 패션 전문가입니다. 사용자가 '내코디'에 저장한 옷 사진들입니다.

<중요한 미션>
각 이미지에서 구체적인 옷 아이템을 정확히 추출하고, 이 아이템들을 조합한 코디를 만들어주세요.

**우선순위:**
1. 이미지 속 실제 옷 아이템이 최우선입니다 (색상, 소재, 스타일 그대로)
2. 사용자 선호 색상은 참고만 하고, 실제 이미지의 아이템을 우선합니다
3. 여러 이미지의 아이템을 자연스럽게 조합하세요

**추출 및 조합 방법:**
- 각 이미지에서: "색상 + 아이템명" 정확히 파악 (예: "화이트 니트 원피스", "블랙 롱 패딩", "베이지 와이드 팬츠")
- 조합 시: 실제 추출한 아이템들을 레이어드 또는 매칭
- 예시: 이미지1에 "화이트 니트 원피스", 이미지2에 "블랙 패딩" → "화이트 니트 원피스 위에 블랙 롱 패딩을 레이어드한 코디"

<사용자 정보>
- 지역: ${region}
- 성별: ${genderText}
${getPhysicalInfoPromptText(height, weight)}

**참고사항 (우선순위 낮음):**
${regionalStyleContext}
${getColorPromptText(colors)}

다음 스타일로 답변해주세요:
${toneInstruction}

**출력 형식:**
이미지에서 추출한 실제 아이템들을 조합한 코디를 구체적으로 설명해주세요.
(예: "베이지 오버사이즈 니트에 블랙 와이드 슬랙스, 그 위에 카키 트렌치코트를 레이어드하고 화이트 스니커즈로 마무리한 룩")`
        }
      ]
    }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.5, // Lower temperature for more accurate item extraction
    });

    const suggestion = completion.choices[0]?.message?.content || '';

    if (!suggestion) {
      throw new Error("Failed to generate a suggestion from the provided images.");
    }

    // Generate an image from the extracted and combined items
    const imageUrl = await generateOutfitImage(suggestion, gender, height, weight, profileImage);

    return { imageUrl, suggestion };

  } catch (error) {
    console.error("Error generating outfit from liked images:", error);
    throw new Error("좋아요한 이미지를 기반으로 추천 이미지를 생성하는 데 실패했습니다.");
  }
}

// Get alternative outfit suggestion when user dislikes a suggestion
export async function getAlternativeOutfitSuggestion(
  dislikedSuggestion: string,
  region: string,
  gender: Gender,
  tone: Tone,
  colors: string[],
  height: string,
  weight: string
): Promise<{ suggestion: string; quickReplies: string[] }> {
  const genderText = gender === 'male' ? '남성' : gender === 'female' ? '여성' : '남녀 공용';
  const toneInstruction = getTonePrompt(tone);

  const prompt = `당신은 패션 코디네이터입니다.

사용자가 이전에 제안된 이 코디를 '싫어요'라고 했습니다: "${dislikedSuggestion}".

이전 제안과는 분위기가 완전히 다른 새로운 스타일의 코디를 제안해주세요. 더 창의적이어도 좋습니다.

<사용자 정보>
- 지역: ${region}
- 성별: ${genderText}
${getPhysicalInfoPromptText(height, weight)}
${regionalStyleContext}
${getColorPromptText(colors)}
${temperatureClothingGuide}

다음 스타일로 답변해주세요:
${toneInstruction}

새로운 코디 제안을 2-3문장으로 작성하고, 2개의 후속 질문도 제안해주세요.
첫 번째 후속 질문은 반드시 "제안된 코디 이미지로 보여줘"여야 합니다.

다음 JSON 형식으로 답변해주세요:
{
  "suggestion": "새로운 코디 제안",
  "quickReplies": ["제안된 코디 이미지로 보여줘", "다른 후속 질문"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(responseText);

    return {
      suggestion: parsed.suggestion || '다른 스타일을 추천합니다.',
      quickReplies: parsed.quickReplies || ['제안된 코디 이미지로 보여줘', '다른 스타일 보여줘']
    };
  } catch (error) {
    console.error("Error getting alternative outfit suggestion:", error);
    throw new Error("다른 스타일 추천을 생성하는 데 실패했습니다.");
  }
}
