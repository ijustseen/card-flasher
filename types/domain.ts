export type Card = {
  id: number;
  phrase: string;
  translation: string;
  description_en: string;
  examples_en: string[];
  groupIds: number[];
};

export type Group = {
  id: number;
  name: string;
  cardCount: number;
};
