import { useMutation } from "react-query"
import useGeminiClient from '../hooks/useGeminiClient'
import useSettingsStore from '../../logseq/stores/useSettingsStore'
import { GeminiAIModelEnum } from "../types/models"
import { Embedding } from "../../chat/types/gpt"
import { ChatMessage, ChatMessageRoleEnum } from "../../chat/types/chat"
import { cosineSimilarity } from "../../shared/utils/math"

const buildPrompt = (query: string, relevantGeminiEmbeddings: Embedding[], relatedGeminiEmbeddings: Embedding[]) => {  
  return `You are an AI assistant of a LogSeq plugin for LogSeq user.
Please answer user's query (please format your answer using markdown syntax) based on relevant documents below (When a document mentions another document's title by using this syntax: [[another document title]], it means that the document have relation with those other mentioned document.) Please answer only the query below based on the document, don't mention anything about LogSeq plugin, your output will be directly displayed to the users of this plugin.:

QUERY: ${query}
RELEVANT DOCUMENTS: 
${relevantGeminiEmbeddings.map((document, idx) => `Doc ${idx + 1}:\nDoc Title: ${document.title}\nDoc Content:\n${document.text}\n`)}
RELATED DOCUMENTS:
${relatedGeminiEmbeddings.map((document, idx) => `Doc ${idx + 1}:\nDoc Title: ${document.title}\nDoc Content:\n${document.text}\n`)}
`
}

const useGenerateContent = () => {
  const { gemini } = useGeminiClient()
  const { settings } = useSettingsStore()

  return useMutation({
    mutationFn: async ({prevContents, query, embeddings}: {prevContents: ChatMessage[], query: string, embeddings: Embedding[]}) => {
      if (gemini) {
        const model = gemini.getGenerativeModel({
          model: settings.geminiModel,
        })
        const embeddingModel = gemini.getGenerativeModel({ model: GeminiAIModelEnum.TextEmbedding004 });

        const queryEmbedding = await embeddingModel.embedContent(query)

        const similarityScores: (Embedding & {score: number})[] = embeddings.map(doc => ({
          title: doc.title,
          embeddings: doc.embeddings,
          text: doc.text,
          score: cosineSimilarity(queryEmbedding.embedding.values, doc.embeddings)
        }));

        const sortedDocuments = similarityScores.sort((a, b) => b.score - a.score);
        const relevantEmbeddings = sortedDocuments.filter(doc => doc.score > 0);

        const relevantEmbeddingsTitleMap: Record<string, boolean> = {}

        relevantEmbeddings.forEach((doc) => {
          relevantEmbeddingsTitleMap[doc.title] = true
        })

        const prompt = buildPrompt(query, relevantEmbeddings, embeddings.filter((doc) => !relevantEmbeddingsTitleMap[doc.title]))

        return model.generateContentStream({
          contents: [
            ...prevContents.map((content) => ({
              role: content.role,
              parts: [
                {
                  text: content.content,
                }
              ]
            })),
            {
              role: ChatMessageRoleEnum.User,
              parts: [
                {
                  text: prompt,
                }
              ]
            }
          ]
        })        
      }
    },
    mutationKey: ['generate-content']
  })
}

export default useGenerateContent