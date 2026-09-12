import { db } from "@/lib/db";

export async function generateExpenseCode(): Promise<string> {
  const last = await db.expenses.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("G", ""), 10) : 0;
  return `G${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateSaleCode(): Promise<string> {
  const last = await db.sales.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("V", ""), 10) : 0;
  return `V${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generatePurchaseCode(): Promise<string> {
  const last = await db.purchases.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("C", ""), 10) : 0;
  return `C${String(lastNum + 1).padStart(6, "0")}`;
}

// Taller de confección
export async function generateGarmentCode(): Promise<string> {
  const last = await db.garments.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("PT", ""), 10) : 0;
  return `PT${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateMaterialCode(): Promise<string> {
  const last = await db.materials.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("MT", ""), 10) : 0;
  return `MT${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateProductionCode(): Promise<string> {
  const last = await db.productionOrders.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("PR", ""), 10) : 0;
  return `PR${String(lastNum + 1).padStart(6, "0")}`;
}

// Agricultura
export async function generateCropCode(): Promise<string> {
  const last = await db.crops.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("CU", ""), 10) : 0;
  return `CU${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateLotCode(): Promise<string> {
  const last = await db.farmLots.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("LT", ""), 10) : 0;
  return `LT${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateAgroInputCode(): Promise<string> {
  const last = await db.agroInputs.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("IN", ""), 10) : 0;
  return `IN${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateApplicationCode(): Promise<string> {
  const last = await db.applications.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("AP", ""), 10) : 0;
  return `AP${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateLaborCode(): Promise<string> {
  const last = await db.labors.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("LB", ""), 10) : 0;
  return `LB${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateHarvestCode(): Promise<string> {
  const last = await db.harvests.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("CO", ""), 10) : 0;
  return `CO${String(lastNum + 1).padStart(6, "0")}`;
}

// Repuestos automotrices
export async function generateAutoPartCode(): Promise<string> {
  const last = await db.autoParts.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("RP", ""), 10) : 0;
  return `RP${String(lastNum + 1).padStart(6, "0")}`;
}

// Crianza
export async function generateAnimalCode(): Promise<string> {
  const last = await db.animals.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("AN", ""), 10) : 0;
  return `AN${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateBreedingLotCode(): Promise<string> {
  const last = await db.breedingLots.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("CR", ""), 10) : 0;
  return `CR${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateFeedingCode(): Promise<string> {
  const last = await db.feedings.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("AL", ""), 10) : 0;
  return `AL${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateReproductionCode(): Promise<string> {
  const last = await db.reproductions.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("RE", ""), 10) : 0;
  return `RE${String(lastNum + 1).padStart(6, "0")}`;
}

export async function generateLivestockProductionCode(): Promise<string> {
  const last = await db.livestockProductions.orderBy("code").last();
  const lastNum = last ? parseInt(last.code.replace("LP", ""), 10) : 0;
  return `LP${String(lastNum + 1).padStart(6, "0")}`;
}
