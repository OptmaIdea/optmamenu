import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Save, Loader, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface LegalTermsProps {
    programId: string;
}

const DEFAULT_PROGRAM_TERMS = `REGULAMENTO DO PROGRAMA DE FIDELIDADE E RESGATE DE VOUCHERS
{{STORE_NAME}} — Plataforma de Gestão para Comércios Locais
Última atualização: {{CURRENT_DATE}}

CLÁUSULA 1ª – DO OBJETO E ÂMBITO DE APLICAÇÃO
1.1. O presente Regulamento disciplina as condições gerais de participação no Programa de Fidelidade oferecido pela loja comercial que utiliza a plataforma OptmaMenu, doravante denominada simplesmente "LOJA", bem como as regras para resgate de prêmios mediante vouchers digitais.
1.2. Ao aderir ao Programa de Fidelidade, o cliente, doravante denominado "PARTICIPANTE", declara ter plena capacidade jurídica, ter lido, compreendido e aceito integralmente todas as cláusulas deste Regulamento.
1.3. Este Regulamento aplica-se exclusivamente às operações realizadas por meio do cardápio digital da LOJA e não se estende a outras formas de relacionamento comercial entre as partes.

CLÁUSULA 2ª – DAS DEFINIÇÕES
2.1. Para fins deste Regulamento, considera-se:
a) Programa de Fidelidade: sistema de recompensas baseado no acúmulo de pontos por parte do PARTICIPANTE mediante compras realizadas na LOJA;
b) Pontos: unidade de valor virtual acumulada pelo PARTICIPANTE conforme regras estabelecidas pela LOJA;
c) Voucher: documento digital único e intransferível, contendo QR Code exclusivo, gerado automaticamente pelo sistema após resgate de pontos, que confere direito ao PARTICIPANTE a receber o prêmio correspondente;
d) Prêmio: benefício oferecido pela LOJA em troca de pontos, podendo ser desconto em compras futuras, produto físico ou serviço;
e) Dia útil: dia em que a LOJA mantém seu horário regular de funcionamento, conforme cadastrado em seu perfil no sistema OptmaMenu, excluindo domingos, feriados municipais, estaduais ou nacionais e dias de fechamento extraordinário previamente comunicados;
f) Data de validade: último dia corrido em que o voucher pode ser resgatado, sujeito à prorrogação automática conforme Cláusula 7ª.

CLÁUSULA 3ª – DA ADESÃO E ACÚMULO DE PONTOS
3.1. A adesão ao Programa de Fidelidade é voluntária e ocorre mediante aceitação explícita do PARTICIPANTE no momento do cadastro ou posteriormente na seção "Meus Pontos" do aplicativo.
3.2. Os pontos são acumulados exclusivamente em compras finalizadas e pagas, conforme regras definidas pela LOJA, podendo variar conforme categoria de fidelidade do PARTICIPANTE (Bronze, Prata, Ouro, Esmeralda ou outras denominações configuradas pela LOJA).
3.3. A LOJA reserva-se o direito de definir livremente:
a) A quantidade de pontos concedidos por real gasto;
b) Bônus por ocasiões especiais (aniversário, primeira compra, etc.);
c) Eventuais ações promocionais que gerem pontos adicionais.
3.4. Os pontos possuem validade de {{POINTS_VALIDITY_MONTHS}} meses contados da última data de acúmulo. Após este período sem atividade, os pontos expiram automaticamente sem aviso prévio.
3.5. O PARTICIPANTE poderá consultar seu saldo de pontos, histórico de movimentações e categoria de fidelidade a qualquer momento na seção "Meus Pontos" do aplicativo.

CLÁUSULA 4ª – DO RESGATE DE PRÊMIOS E GERAÇÃO DE VOUCHERS
4.1. O resgate de prêmios é permitido exclusivamente mediante a troca de pontos acumulados, observando-se a quantidade mínima exigida para cada prêmio configurado pela LOJA.
4.2. O PARTICIPANTE só poderá resgatar prêmios para os quais possua saldo suficiente de pontos no momento da solicitação.
4.3. Ao clicar no botão "Resgatar prêmio", o PARTICIPANTE manifesta concordância expressa com todos os termos deste Regulamento e autoriza a imediata dedução dos pontos correspondentes de seu saldo.
4.4. A dedução dos pontos ocorre automaticamente e irreversivelmente no exato momento da geração do voucher, não dependendo da efetiva utilização do prêmio na LOJA.
4.5. Após a confirmação do resgate, o sistema gera automaticamente um voucher digital contendo:
a) QR Code único e não reproduzível;
b) Descrição do prêmio;
c) Data e hora de emissão;
d) Data de validade ajustada conforme Cláusula 7ª;
e) Código alfanumérico de identificação única.
4.6. O voucher é disponibilizado simultaneamente:
a) Na seção "Meus Vouchers" do aplicativo do PARTICIPANTE, na aba "Ativos";
b) Via mensagem automática enviada ao número de WhatsApp previamente cadastrado pelo PARTICIPANTE.

CLÁUSULA 5ª – DA VALIDADE E PRORROGAÇÃO AUTOMÁTICA DOS VOUCHERS
5.1. Os vouchers possuem prazo de validade de {{VOUCHER_VALIDITY_DAYS}} dias corridos a partir da data e hora de sua emissão, salvo configuração distinta estabelecida pela LOJA para prêmios específicos.
5.2. Em caráter excepcional e como benefício de boa-fé ao PARTICIPANTE, caso o último dia de validade do voucher coincida com data em que a LOJA não esteja em funcionamento (domingo, feriado ou dia de fechamento extraordinário), o prazo de validade será automaticamente prorrogado para o próximo dia útil subsequente em que a LOJA estiver aberta ao público.
5.3. A prorrogação automática é calculada com base nos horários de funcionamento cadastrados pela LOJA no sistema OptmaMenu e não depende de solicitação ou manifestação do PARTICIPANTE.
5.4. O PARTICIPANTE será notificado da prorrogação mediante mensagem automática enviada ao seu WhatsApp cadastrado, contendo a nova data de validade ajustada.
5.5. Após a data de validade ajustada conforme item 5.2, o voucher expira automaticamente, sendo invalidado pelo sistema sem possibilidade de reativação ou prorrogação adicional.

CLÁUSULA 6ª – DAS FORMAS VÁLIDAS DE APRESENTAÇÃO DO VOUCHER
6.1. Para fins de resgate do prêmio, o voucher somente será aceito nas seguintes condições:
a) Apresentação do QR Code diretamente na tela do aplicativo OptmaMenu, na seção "Meus Vouchers > Ativos", com o dispositivo conectado à internet;
b) Apresentação do QR Code na conversa original do WhatsApp enviada automaticamente pelo sistema no momento da geração do voucher, sem que a mensagem tenha sido encaminhada, salva como imagem fora da conversa ou impressa em papel.
6.2. Não serão aceitos vouchers apresentados nas seguintes condições:
a) Imagens do QR Code salvas na galeria do dispositivo ou em qualquer outro local fora da conversa original do WhatsApp;
b) Mensagens encaminhadas para outros contatos ou dispositivos;
c) Impressões em papel, fotografias ou capturas de tela do QR Code;
d) QR Codes parcialmente visíveis, danificados ou com reflexos que impeçam a leitura adequada.
6.3. A LOJA reserva-se o direito de recusar o resgate do prêmio caso o QR Code não seja lido corretamente pelo leitor oficial da LOJA ou haja suspeita de fraude, adulteração ou uso indevido.

CLÁUSULA 7ª – DAS RESPONSABILIDADES DO PARTICIPANTE
7.1. O PARTICIPANTE é exclusivamente responsável por:
a) Manter seus dados cadastrais atualizados, especialmente o número de WhatsApp, pois os vouchers são enviados exclusivamente para este canal;
b) Proteger o sigilo de seu voucher, não compartilhando o QR Code com terceiros sob qualquer hipótese;
c) Verificar a data de validade do voucher antes de dirigir-se à LOJA;
d) Garantir que o dispositivo utilizado para apresentação do voucher esteja com bateria suficiente e conectado à internet no momento do resgate.
7.2. O PARTICIPANTE reconhece e aceita que:
a) O prêmio será entregue à primeira pessoa que apresentar o QR Code válido, independentemente de ser o titular original da conta;
b) Não serão aceitas reclamações decorrentes de uso indevido do voucher por terceiros, ainda que por engano, descuido, extravio do aparelho ou compartilhamento acidental do QR Code;
c) Em caso de perda de acesso à conta do aplicativo ou ao dispositivo onde o voucher foi recebido, não haverá reposição do voucher ou estorno dos pontos deduzidos;
d) Vouchers expirados não serão aceitos sob nenhuma hipótese, exceto na hipótese de prorrogação automática prevista na Cláusula 5ª.
7.3. O PARTICIPANTE declara estar ciente de que os pontos são deduzidos imediatamente na geração do voucher e que tal operação é irreversível, não havendo direito a estorno em caso de arrependimento, descuido ou impossibilidade de utilização do voucher por motivos de sua exclusiva responsabilidade.

CLÁUSULA 8ª – DAS RESPONSABILIDADES DA LOJA
8.1. A LOJA compromete-se a:
a) Manter atualizados os horários de funcionamento no sistema para garantir o correto funcionamento da prorrogação automática prevista na Cláusula 5ª;
b) Validar vouchers dentro do prazo de validade ajustado, desde que apresentados nas formas previstas na Cláusula 6ª;
c) Entregar o prêmio correspondente ao voucher apresentado corretamente, observadas as condições específicas de cada prêmio;
d) Estornar os pontos deduzidos exclusivamente nos casos de indisponibilidade comprovada e definitiva do prêmio, sem previsão de reposição em curto prazo.
8.2. A LOJA reserva-se o direito de:
a) Recusar o resgate do prêmio caso haja suspeita fundamentada de fraude, má-fé ou manipulação do sistema;
b) Oferecer prêmio alternativo de valor equivalente em casos de indisponibilidade temporária do prêmio original, mediante aceitação expressa do PARTICIPANTE;
c) Suspender temporariamente o Programa de Fidelidade por motivos técnicos, de força maior ou para atualizações no sistema, com comunicação prévia sempre que possível.

CLÁUSULA 9ª – DAS CONDIÇÕES ESPECÍFICAS DE ALGUNS PRÊMIOS
9.1. Prêmios classificados como "desconto" (ex: "10% OFF na próxima compra") não são cumulativos entre si, sendo permitida a utilização de apenas um voucher por compra.
9.2. Prêmios que combinem pontos e valor monetário adicional (ex: "1.000 pontos + R$ 13,00") somente serão entregues após o pagamento integral do valor adicional ao atendente da LOJA.
9.3. A LOJA não se responsabiliza por eventuais variações de preço de produtos que compõem o prêmio, mantendo-se o valor configurado no momento do resgate.

CLÁUSULA 10ª – DA IRREVERSIBILIDADE E NÃO REEMBOLSO
10.1. Uma vez gerado o voucher, a operação é irreversível e os pontos não retornarão ao saldo do PARTICIPANTE, independentemente de o voucher ter sido utilizado ou não.
10.2. Não haverá estorno de pontos em nenhuma das seguintes hipóteses:
a) Arrependimento do PARTICIPANTE após a geração do voucher;
b) Expiração do prazo de validade do voucher;
c) Uso indevido do voucher por terceiros;
d) Perda de acesso ao aplicativo ou dispositivo onde o voucher foi recebido;
e) Descuido ou negligência do PARTICIPANTE na guarda do voucher.
10.3. Em nenhuma hipótese os vouchers poderão ser convertidos em valores monetários, troco, crédito em espécie ou qualquer outra forma de compensação financeira direta.
10.4. A única exceção ao princípio da irreversibilidade ocorrerá nos casos previstos na Cláusula 8.1, alínea "d", mediante análise e aprovação expressa pela LOJA.

CLÁUSULA 11ª – DA PROTEÇÃO DE DADOS PESSOAIS
11.1. O tratamento dos dados pessoais do PARTICIPANTE observará rigorosamente as disposições da Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e demais normas aplicáveis.
11.2. Os dados coletados serão utilizados exclusivamente para:
a) Operacionalização do Programa de Fidelidade;
b) Envio de vouchers e comunicações transacionais relacionadas;
c) Melhoria da experiência do cliente mediante análise anônima de uso.
11.3. O PARTICIPANTE poderá exercer seus direitos como titular de dados (acesso, retificação, anonimização, bloqueio ou eliminação) mediante solicitação formal à LOJA.

CLÁUSULA 12ª – DAS DISPOSIÇÕES FINAIS
12.1. A LOJA poderá alterar este Regulamento a qualquer momento, com vigência após comunicação prévia de trinta (30) dias ao PARTICIPANTE por meio de aviso no aplicativo ou mensagem por WhatsApp.
12.2. A continuidade da participação no Programa de Fidelidade após as alterações implica aceitação tácita das novas condições.
12.3. Eventuais dúvidas sobre este Regulamento poderão ser esclarecidas pelo atendimento da LOJA durante seu horário de funcionamento.
12.4. Este Regulamento não gera vínculo empregatício, societário, de consumo ou qualquer outra relação jurídica além da prevista neste documento.
12.5. Os PARTICIPANTES que não concordarem com qualquer disposição deste Regulamento deverão abster-se de participar do Programa de Fidelidade ou solicitar sua exclusão mediante contato com a LOJA.

CLÁUSULA 13ª – DO FORO
13.1. Para dirimir quaisquer controvérsias decorrentes da interpretação ou execução deste Regulamento, as partes elegem o foro da comarca do domicílio da LOJA, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

DECLARAÇÃO DE ACEITAÇÃO
Eu, PARTICIPANTE do Programa de Fidelidade da LOJA, declaro ter lido, compreendido e aceito integralmente todas as cláusulas deste Regulamento, inclusive no que tange à irreversibilidade da dedução de pontos na geração de vouchers, à responsabilidade exclusiva pela guarda do voucher, à prorrogação automática para dias de fechamento da LOJA e à não possibilidade de estorno ou conversão em valores monetários.
Data da aceitação: {{ACCEPTANCE_DATE}}
Assinatura digital tácita mediante uso do sistema`;

const DEFAULT_VOUCHER_TERMS = `🎫 TERMOS DE RESGATE DE VOUCHER — {{STORE_NAME}}
Versão Consolidada com Prorrogação Automática para Dias de Fechamento
Última atualização: {{CURRENT_DATE}}

📋 RESUMO RÁPIDO (Para o Cliente)
✅ Válido por: {{VOUCHER_VALIDITY_DAYS}} dias corridos a partir da emissão
✅ Prorrogação automática: Se a loja estiver fechada no último dia de validade, seu voucher será prorrogado para o próximo dia útil de funcionamento
✅ Pontos deduzidos: Imediatamente ao gerar o voucher
✅ Não reembolsável: Pontos não retornam após emissão
✅ Uso único: Apresente o QR Code na loja para resgatar
✅ Proteja seu voucher: É de sua responsabilidade mantê-lo seguro

🔁 COMO RESGATAR SEU PRÊMIO (Passo a Passo)
1. Clique em "Resgatar prêmio" — disponível apenas se você tiver pontos suficientes.
2. Seus pontos serão deduzidos imediatamente do seu saldo ao confirmar o resgate.
3. Um voucher digital será gerado com QR Code único e enviado para:
   • Sua seção "Meus Vouchers" no app
   • Seu WhatsApp cadastrado (mensagem automática)
4. Apresente o voucher na loja:
   • Mostre o QR Code diretamente no app ou na conversa do WhatsApp
   • Pague qualquer valor adicional (se aplicável) ao atendente
5. Receba seu prêmio após validação do QR Code pelo lojista.

⏳ VALIDADE E PRORROGAÇÃO AUTOMÁTICA
• Prazo base de validade: {{VOUCHER_VALIDITY_DAYS}} dias corridos a partir da data/hora de emissão
• Prorrogação automática: ⭐ IMPORTANTE: Se a loja estiver fechada no último dia de validade (domingo, feriado ou dia não comercial), seu voucher será prorrogado automaticamente para o próximo dia útil em que a loja estiver aberta.
• Expiração final: O voucher é invalidado pelo sistema após o prazo ajustado — sem necessidade de ação manual
• Uso único: Cada voucher pode ser resgatado uma única vez

ℹ️ Como funciona a prorrogação:
O sistema verifica automaticamente os horários de funcionamento cadastrados pela loja. Se o último dia de validade coincidir com um dia de fechamento, a data final é ajustada para o próximo dia útil. Você receberá uma notificação via WhatsApp:
"🔔 Seu voucher '{prêmio}' foi prorrogado até {nova_data} porque a loja estava fechada em {data_original}."

✅ FORMAS DE APRESENTAÇÃO VÁLIDAS
✅ QR Code no app "Meus Vouchers"
✅ QR Code na conversa original do WhatsApp
❌ Imagens salvas fora da conversa
❌ Encaminhamentos
❌ Impressões em papel

💳 DEDUÇÃO DE PONTOS E IRREVERSIBILIDADE
• Dedução imediata: Seus pontos são abatidos do saldo no momento da geração do voucher, não na hora do resgate na loja.
• Não há estorno automático: Uma vez gerado, o voucher não pode ser cancelado e os pontos não retornam ao seu saldo.
• Exceção única: A loja poderá estornar pontos apenas em casos de indisponibilidade comprovada do prêmio (ex: item esgotado sem previsão de reposição).
• Sem ressarcimento em dinheiro: Vouchers não podem ser convertidos em valores monetários, troco ou crédito em espécie.

🛡️ RESPONSABILIDADES DO CLIENTE
Você é totalmente responsável por:
• Proteger seu voucher:
  - Mantenha o QR Code em sigilo e não compartilhe com terceiros
  - O prêmio será entregue à primeira pessoa que apresentar o QR Code válido, mesmo que não seja você
  - Não aceitaremos reclamações por vouchers resgatados por terceiros (mesmo em casos de engano, descuido ou extravio do aparelho)
• Verificar validade:
  - É sua obrigação conferir a data de expiração antes de ir à loja
  - Vouchers expirados não serão aceitos sob nenhuma hipótese (exceto prorrogação automática)
• Dados cadastrais:
  - Mantenha seu WhatsApp e e-mail atualizados — vouchers são enviados exclusivamente para os contatos cadastrados
  - Em caso de perda de acesso à conta ou aparelho, não haverá reposição do voucher

🏪 RESPONSABILIDADES DA LOJA / EXCEÇÕES
A loja se compromete a:
✅ Validar vouchers dentro do prazo de validade (incluindo prorrogações automáticas)
✅ Entregar o prêmio correspondente ao voucher apresentado corretamente
✅ Estornar pontos apenas em casos de indisponibilidade comprovada do prêmio (mediante análise do atendente)
✅ Manter horários de funcionamento atualizados no sistema para garantir prorrogações corretas

A loja reserva-se o direito de:
⚠️ Recusar o resgate se houver suspeita de fraude, má-fé ou manipulação do QR Code
⚠️ Oferecer prêmio alternativo equivalente (com concordância do cliente) em casos de indisponibilidade
⚠️ Invalidar vouchers gerados por falha técnica comprovada (raro e sob análise)

⚠️ LIMITAÇÕES IMPORTANTES
• Múltiplos vouchers: 1 resgate por cliente por prêmio (não acumulável no mesmo pedido)
• Prêmios com valor adicional: Só liberado após pagamento integral do valor extra
• Vouchers expirados: Não aceitos — pontos não retornam ao saldo (exceto prorrogação automática)
• Perda de acesso: Não há reposição de voucher por extravio de aparelho ou senha
• Reclamações: Não aceitamos contestações por: compartilhamento acidental do QR Code, uso por terceiros ou descuido do cliente
• Descontos: Vouchers de desconto não são cumulativos — apenas 1 voucher por compra

✅ ACEITAÇÃO DOS TERMOS
Ao clicar em "Resgatar prêmio", você declara que:
• Leu, compreendeu e aceita integralmente estes termos
• Está ciente de que os pontos serão deduzidos imediatamente
• Assume total responsabilidade pela guarda e uso do voucher
• Reconhece que o voucher é pessoal e intransferível (mesmo que tecnicamente compartilhável)
• Concorda que a loja não será responsabilizada por uso indevido por terceiros
• Aceita a prorrogação automática para dias de fechamento da loja como benefício de boa-fé

ℹ️ Termos completos do programa de fidelidade: Disponíveis na seção "Meus Pontos" do aplicativo`;

export default function LegalTerms({ programId }: LegalTermsProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [programTerms, setProgramTerms] = useState('');
    const [voucherTerms, setVoucherTerms] = useState('');

    useEffect(() => {
        fetchTerms();
    }, [programId]);

    const fetchTerms = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('fidelity_programs')
                .select('program_terms, voucher_terms, points_validity_months')
                .eq('id', programId)
                .maybeSingle();

            if (error) throw error;

            // Apply template replacements for display
            const processedProgramTerms = data?.program_terms ?? DEFAULT_PROGRAM_TERMS;
            const processedVoucherTerms = data?.voucher_terms ?? '';

            setProgramTerms(processedProgramTerms);
            setVoucherTerms(processedVoucherTerms);
        } catch (error) {
            console.error('Error fetching terms:', error);
            toast.error('Erro ao carregar termos legais');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('fidelity_programs')
                .update({
                    program_terms: programTerms,
                    voucher_terms: voucherTerms
                })
                .eq('id', programId);

            if (error) throw error;
            toast.success('Termos salvos com sucesso!');
        } catch (error: any) {
            console.error('Error saving terms:', error);
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleLoadTemplate = (type: 'program' | 'voucher') => {
        if (type === 'program') {
            setProgramTerms(DEFAULT_PROGRAM_TERMS);
        } else {
            setVoucherTerms(DEFAULT_VOUCHER_TERMS);
        }
        toast.success(`Template de ${type === 'program' ? 'programa' : 'voucher'} carregado! Edite conforme necessário.`);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Loader className="animate-spin text-brand-green" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Info Alert */}
            <div className="bg-brand-purple/10 border border-brand-purple/20 rounded-xl p-4">
                <div className="flex gap-3">
                    <AlertCircle className="text-brand-purple flex-shrink-0" size={20} />
                    <div className="text-sm text-brand-purple dark:text-brand-purple-light">
                        <p className="font-bold mb-1">Variáveis Disponíveis</p>
                        <p className="text-xs leading-relaxed">
                            Use as seguintes marcações que serão substituídas automaticamente:<br />
                            <code className="bg-brand-purple/20 px-1 py-0.5 rounded text-brand-purple dark:text-brand-purple-light">{'{{STORE_NAME}}'}</code> - Nome da loja<br />
                            <code className="bg-brand-purple/20 px-1 py-0.5 rounded text-brand-purple dark:text-brand-purple-light">{'{{CURRENT_DATE}}'}</code> - Data atual<br />
                            <code className="bg-brand-purple/20 px-1 py-0.5 rounded text-brand-purple dark:text-brand-purple-light">{'{{POINTS_VALIDITY_MONTHS}}'}</code> - Meses de validade dos pontos<br />
                            <code className="bg-brand-purple/20 px-1 py-0.5 rounded text-brand-purple dark:text-brand-purple-light">{'{{VOUCHER_VALIDITY_DAYS}}'}</code> - Dias de validade do voucher<br />
                            <code className="bg-brand-purple/20 px-1 py-0.5 rounded text-brand-purple dark:text-brand-purple-light">{'{{ACCEPTANCE_DATE}}'}</code> - Data de aceitação
                        </p>
                    </div>
                </div>
            </div>

            {/* Program Terms */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <FileText className="text-brand-green" size={24} />
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Regulamento do Programa</h2>
                                <p className="text-xs text-gray-500">Termos gerais do programa de fidelidade</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleLoadTemplate('program')}
                            className="px-3 py-2 text-sm font-bold text-brand-green hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition flex items-center gap-2"
                        >
                            <Copy size={16} />
                            Carregar Template
                        </button>
                    </div>
                </div>
                <div className="p-6">
                    <textarea
                        value={programTerms}
                        onChange={(e) => setProgramTerms(e.target.value)}
                        className="w-full h-96 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                        placeholder="Digite o regulamento do programa de fidelidade..."
                    />
                </div>
            </section>

            {/* Voucher Terms */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <FileText className="text-purple-500" size={24} />
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Regulamento de Vouchers</h2>
                                <p className="text-xs text-gray-500">Termos específicos para uso de vouchers (opcional)</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleLoadTemplate('voucher')}
                            className="px-3 py-2 text-sm font-bold text-brand-green hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition flex items-center gap-2"
                        >
                            <Copy size={16} />
                            Carregar Template
                        </button>
                    </div>
                </div>
                <div className="p-6">
                    <textarea
                        value={voucherTerms}
                        onChange={(e) => setVoucherTerms(e.target.value)}
                        className="w-full h-64 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                        placeholder="Digite o regulamento específico de vouchers (se necessário)..."
                    />
                </div>
            </section>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-brand-green hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-200 dark:shadow-none flex items-center gap-2 transition disabled:opacity-70"
                >
                    {saving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar Termos Legais
                </button>
            </div>
        </div>
    );
}
