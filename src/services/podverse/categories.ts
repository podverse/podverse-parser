import { Category, getRepository, In } from "podverse-orm"
import { ParsedPodcast } from "../partytime/compat"

const findCategories = async (categories: string[]) => {
  const c: string[] = []
  for (const category of categories) {
    if (category.indexOf('>') > 0) {
      c.push(category.substr(0, category.indexOf('>')).replace(/\s/g, ''))
    }
    c.push(category.replace(/\s/g, ''))
  }

  const categoryRepo = getRepository(Category)
  let matchedCategories = [] as any
  if (c && c.length > 0) {
    matchedCategories = await categoryRepo.find({
      where: {
        fullPath: In(c)
      }
    })
  }

  return matchedCategories
}

export const handleSaveCategories = async (parsedPodcast: ParsedPodcast) => {
  let categories: Category[] = []
  if (Array.isArray(parsedPodcast.ptCategories) && parsedPodcast.ptCategories.length > 0) {
    categories = await findCategories(parsedPodcast.ptCategories)
  }
  const categoryRepo = getRepository(Category)
  await categoryRepo.save(categories)
  return categories
}