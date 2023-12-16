import { Author, getRepository, In } from "podverse-orm"
import { convertToSlug } from "podverse-shared"
import { ParsedPodcast } from "../partytime/compat"

const generateAuthor = (name: string) => {
  const author = new Author()
  author.name = name
  return author
}

const findOrGenerateAuthors = async (authorNames: string[]) => {
  const authorRepo = getRepository(Author)
  // Make sure to remove duplicate values to avoid unique slug/name value collisions
  const authorNamesArray = [...new Set(authorNames.map((x) => x.trim()))]
  const allAuthorSlugs = authorNamesArray.map((x) => convertToSlug(x))

  let existingAuthors = [] as any
  if (allAuthorSlugs && allAuthorSlugs.length > 0) {
    existingAuthors = await authorRepo.find({
      where: {
        slug: In(allAuthorSlugs)
      }
    })
  }

  const newAuthors: Author[] = []
  const newAuthorNames = authorNamesArray.filter((x) => {
    return !existingAuthors.find((existingAuthor: Author) => {
      return existingAuthor.slug === convertToSlug(x)
    })
  })

  for (const name of newAuthorNames) {
    const author = generateAuthor(name) as never
    newAuthors.push(author)
  }

  for (const existingAuthor of existingAuthors) {
    const matchedName = authorNamesArray.find((x) => convertToSlug(x) === existingAuthor.slug)
    existingAuthor.name = matchedName
  }

  const allAuthors = existingAuthors.concat(newAuthors)

  return allAuthors
}

export const handleSaveAuthors = async (parsedPodcast: ParsedPodcast) => {
  let authors: Author[] = []
  if (Array.isArray(parsedPodcast.ptAuthors) && parsedPodcast.ptAuthors.length > 0) {
    authors = (await findOrGenerateAuthors(parsedPodcast.ptAuthors)) as never
  }
  const authorRepo = getRepository(Author)
  await authorRepo.save(authors)
  return authors
}
