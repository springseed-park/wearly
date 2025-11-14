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

// Mock weather data generator (for demo purposes)
const getMockWeatherData = (region: string): { temp: number; minTemp: number; maxTemp: number; summary: string; description: string } => {
  // Generate somewhat realistic weather based on current date
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12

  let baseTemp = 20;
  let tempVariation = 5;

  // Seasonal adjustment
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
  tone: Tone
): Promise<WeatherData> {
  try {
    // Get mock weather data (in production, this would call a real weather API)
    const weather = getMockWeatherData(region);

    // Generate outfit recommendation using OpenAI
    const genderText = gender === 'male' ? '남성' : gender === 'female' ? '여성' : '남녀 공용';
    const toneInstruction = getTonePrompt(tone);

    const prompt = `당신은 패션 코디네이터입니다. 다음 날씨 정보를 바탕으로 ${genderText}을 위한 옷차림을 추천해주세요.

지역: ${region}
날씨: ${weather.summary}
현재 기온: ${weather.temp}°C
최저/최고: ${weather.minTemp}°C / ${weather.maxTemp}°C

${regionalStyleContext}

다음 스타일로 답변해주세요:
${toneInstruction}

구체적인 아이템들을 언급하면서 2-3문장으로 추천해주세요. 날씨와 기온, 그리고 지역의 패션 스타일을 고려한 실용적인 조언을 해주세요.`;

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
  tone: Tone
): Promise<TextRecommendation> {
  try {
    const genderText = gender === 'male' ? '남성' : gender === 'female' ? '여성' : '남녀 공용';
    const toneInstruction = getTonePrompt(tone);

    // Get current weather for context
    const weather = getMockWeatherData(region);

    const prompt = `당신은 패션 코디네이터입니다. 사용자의 질문에 답변해주세요.

사용자 정보:
- 지역: ${region}
- 성별: ${genderText}
- 현재 날씨: ${weather.summary}, ${weather.temp}°C

사용자 질문: ${text}

${regionalStyleContext}

다음 스타일로 답변해주세요:
${toneInstruction}

구체적인 옷 아이템과 조합을 언급하면서 답변해주세요. 지역의 패션 스타일도 고려해주세요.`;

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
  tone: Tone
): Promise<ImageRecommendation> {
  try {
    const genderText = gender === 'male' ? '남성' : gender === 'female' ? '여성' : '남녀 공용';
    const toneInstruction = getTonePrompt(tone);

    // Convert file to base64 data URL
    const base64DataUrl = await fileToDataUrl(file);

    const weather = getMockWeatherData(region);

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

다음 스타일로 답변해주세요:
${toneInstruction}

이전 분석: ${analysis}

개선 방안이나 대안 코디를 구체적인 아이템 언급과 함께 2-3문장으로 제안해주세요.`;

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
  gender: Gender
): Promise<string | null> {
  try {
    const genderText = gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'unisex';

    // Create a detailed prompt for image generation
    const prompt = `A clean, professional fashion outfit photo on white background. Style: modern Korean fashion, ${genderText} clothing.

Outfit description: ${suggestion}

Requirements:
- Clean white or minimal background
- Professional fashion photography style
- Modern and trendy Korean fashion aesthetic
- Clothing laid out flat or on a mannequin
- Well-lit, high quality
- Focus on the outfit items mentioned`;

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
