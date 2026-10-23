import { connection } from "next/server";
import { FormConfig } from "@/components/FormConfig";
import { obterPesos, obterTemplate } from "@/core/config";
import { TEMPLATE_PADRAO } from "@/core/mensagem";
import { PESOS_PADRAO } from "@/core/pontuacao";

export default async function PaginaConfiguracoes() {
  await connection();
  const [template, pesos] = await Promise.all([obterTemplate(), obterPesos()]);
  return <FormConfig template={template} pesos={pesos} padrao={{ template: TEMPLATE_PADRAO, pesos: PESOS_PADRAO }} />;
}
