import { PartytimeService } from '../services/partytime/parser'
import { config } from '../config'

export const partytimeInstance = new PartytimeService({
  userAgent: config.userAgent
})
