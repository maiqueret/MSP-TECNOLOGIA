const banco = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

function mudarAba(nomeAba) {
    const abas = ['dashboard', 'clientes', 'produtos', 'vendas', 'ordens'];
    abas.forEach(aba => {
        const elementoTela = document.getElementById(`tela-${aba}`);
        const elementoBotao = document.getElementById(`btn-${aba}`);
        if (aba === nomeAba) {
            elementoTela.classList.remove('hidden');
            elementoBotao.className = "w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all cursor-pointer";
        } else {
            elementoTela.classList.add('hidden');
            elementoBotao.className = "w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 hover:text-white font-medium transition-all cursor-pointer";
        }
    });

    const titulos = { dashboard: '📊 Dashboard', clientes: '👥 Gerenciar Clientes', produtos: '📦 Estoque de Peças', vendas: '🛒 Venda de Balcão', ordens: '📋 Quadro de Monitoramento de OS' };
    document.getElementById('titulo-pagina').innerText = titulos[nomeAba];

    if (nomeAba === 'clientes') { document.getElementById('busca-cliente').value = ''; listarClientes(); }
    if (nomeAba === 'produtos') { document.getElementById('busca-produto').value = ''; listarProdutos(); }
    if (nomeAba === 'vendas' || nomeAba === 'ordens') carregarSeletoresOperacao();
    atualizarContadoresDashboard();
}

async function carregarSeletoresOperacao() {
    const { data: clientes } = await banco.from('clientes').select('id, nome').order('nome');
    document.getElementById('os-cliente').innerHTML = clientes ? clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('') : '';
    document.getElementById('vd-cliente').innerHTML = clientes ? clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('') : '';

    const { data: produtos } = await banco.from('produtos').select('id, nome, preco, estoque').order('nome');
    const optionsProdutos = produtos ? produtos.map(p => `<option value="${p.id}" data-preco="${p.preco}" data-estoque="${p.estoque}">${p.nome} (Estoque: ${p.estoque}) - R$ ${p.preco.toFixed(2)}</option>`).join('') : '';
    
    document.getElementById('vd-produto').innerHTML = `<option value="">-- Nenhuma Peça Aplicada (Apenas Mão de Obra) --</option>` + optionsProdutos;

    listarOrdensEVendas();
}

// ================= CLIENTES E PRODUTOS =================
document.getElementById('form-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('cli-nome').value;
    const telefone = document.getElementById('cli-telefone').value;
    await banco.from('clientes').insert([{ nome, telefone }]);
    document.getElementById('form-cliente').reset(); listarClientes();
});

async function listarClientes() {
    const termo = document.getElementById('busca-cliente').value;
    let query = banco.from('clientes').select('*').order('nome');
    if (termo) query = query.ilike('nome', `%${termo}%`);
    const { data } = await query;
    document.getElementById('tabela-clientes-corpo').innerHTML = data ? data.map(c => `<tr><td class="p-4 font-medium text-gray-900">${c.nome}</td><td class="p-4 text-gray-600">${c.telefone || '-'}</td><td class="p-4 text-center"><button onclick="deletarCliente(${c.id}, '${c.nome}')" class="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg cursor-pointer">🗑️ Excluir</button></td></tr>`).join('') : '';
}

async function deletarCliente(id, nome) {
    if (confirm(`Excluir ${nome}?`)) { await banco.from('clientes').delete().eq('id', id); listarClientes(); }
}

document.getElementById('form-produto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('prod-nome').value;
    const preco = parseFloat(document.getElementById('prod-preco').value);
    const estoque = parseInt(document.getElementById('prod-estoque').value);
    await banco.from('produtos').insert([{ nome, preco, estoque }]);
    document.getElementById('form-produto').reset(); listarProdutos();
});

async function listarProdutos() {
    const termo = document.getElementById('busca-produto').value;
    let query = banco.from('produtos').select('*').order('nome');
    if (termo) query = query.ilike('nome', `%${termo}%`);
    const { data } = await query;
    
    document.getElementById('tabela-produtos-corpo').innerHTML = data ? data.map(p => `<tr>
        <td class="p-4 font-medium text-gray-900">${p.nome}</td>
        <td class="p-4 text-gray-700">R$ ${p.preco.toFixed(2)}</td>
        <td class="p-4 text-gray-600">${p.estoque} un</td>
        <td class="p-4 text-center space-x-2">
            <button onclick="abrirModalEditar(${p.id}, '${p.nome}', ${p.preco}, ${p.estoque})" class="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-1.5 rounded-lg border border-blue-200 cursor-pointer">✏️ Editar</button>
            <button onclick="deletarProduto(${p.id}, '${p.nome}')" class="text-xs bg-red-50 text-red-600 font-bold px-2 py-1.5 rounded-lg border border-red-200 cursor-pointer">🗑️ Remover</button>
        </td>
    </tr>`).join('') : '';
}

async function deletarProduto(id, nome) {
    if (confirm(`Remover ${nome}?`)) { await banco.from('produtos').delete().eq('id', id); listarProdutos(); }
}

// ================= CENTRAL COMERCIAL: VENDA DE BALCÃO (COM ATUALIZAÇÃO DO SERVIÇO REALIZADO) =================
async function executarVendaBalcao() {
    const clienteId = document.getElementById('vd-cliente').value;
    const produtoId = document.getElementById('vd-produto').value;
    const qtd = parseInt(document.getElementById('vd-qtd').value) || 1;
    const valorMaoDeObra = parseFloat(document.getElementById('vd-valor-servico').value) || 0;
    
    // Captura a descrição do serviço técnico realizado digitado no balcão
    const servicoDescricao = document.getElementById('vd-descricao-servico').value || "Serviço Comercial Balcão";

    let valorPeca = 0;
    let estoqueAtual = 0;

    if (produtoId) {
        const produtoSelect = document.getElementById('vd-produto');
        const opcao = produtoSelect.options[produtoSelect.selectedIndex];
        valorPeca = parseFloat(opcao.getAttribute('data-preco')) * qtd;
        estoqueAtual = parseInt(opcao.getAttribute('data-estoque'));
        if (estoqueAtual < qtd) { alert("Estoque de peças insuficiente!"); return; }
    }

    if (valorMaoDeObra === 0 && !produtoId) { alert("Preencha o valor do serviço ou vincule uma peça."); return; }

    // No banco de dados: guardamos o termo fixo na estrutura, e injetamos o detalhe real na coluna defeito_relatado
    const { data: novaVenda, error } = await banco.from('ordens_servico').insert([{
        cliente_id: clienteId,
        descricao_equipamento: "Faturamento de Balcão",
        defeito_relatado: servicoDescricao,
        status: 'Concluido',
        valor_mao_de_obra: valorMaoDeObra
    }]).select();

    if (error) { alert("Erro ao faturar: " + error.message); return; }

    if (produtoId && novaVenda) {
        await banco.from('itens_os').insert([{ os_id: novaVenda[0].id, produto_id: produtoId, quantidade: qtd, preco_unitario: valorPeca / qtd }]);
        await banco.from('produtos').update({ estoque: estoqueAtual - qtd }).eq('id', produtoId);
    }

    alert("Faturamento concluído com sucesso!");
    document.getElementById('vd-valor-servico').value = "0.00";
    document.getElementById('vd-descricao-servico').value = "";
    document.getElementById('vd-qtd').value = "1";
    carregarSeletoresOperacao();
}

// ================= MONITORAMENTO DE OS =================
async function finalizarOperacao() {
    const clienteId = document.getElementById('os-cliente').value;
    const statusAtual = document.getElementById('os-status').value;
    const equipamento = document.getElementById('os-equipamento').value;
    const defeito = document.getElementById('os-descricao').value;

    if (!equipamento || !defeito) { alert("Preencha o equipamento e a descrição do serviço técnico."); return; }

    await banco.from('ordens_servico').insert([{
        cliente_id: clienteId,
        descricao_equipamento: equipamento,
        defeito_relatado: defeito,
        status: statusAtual,
        valor_mao_de_obra: 0 
    }]);

    alert(`OS aberta com sucesso!`);
    document.getElementById('os-equipamento').value = ''; 
    document.getElementById('os-descricao').value = '';
    carregarSeletoresOperacao();
}

async function mudarStatusRapido(id, novoStatus) {
    const { error } = await banco.from('ordens_servico').update({ status: novoStatus }).eq('id', id);
    if (!error) listarOrdensEVendas();
}

// ================= RENDERIZADOR COM BOTÕES DE EXCLUSÃO =================
async function listarOrdensEVendas() {
    const { data, error } = await banco.from('ordens_servico').select('*, clientes(*), itens_os(*, produtos(*))').order('id', { ascending: false });
    if (error || !data) return;

    window.historicoLancamentos = data;

    const apenasVendas = data.filter(item => item.descricao_equipamento === "Faturamento de Balcão");
    const apenasOS = data.filter(item => item.descricao_equipamento !== "Faturamento de Balcão");

    // 1. Renderiza Caixa de Balcão com Botão Excluir Venda
    const corpoVendas = document.getElementById('tabela-vendas-corpo');
    corpoVendas.innerHTML = apenasVendas.map(v => {
        const d = v.created_at ? new Date(v.created_at) : new Date();
        const dataF = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        let pecTotal = v.itens_os && v.itens_os[0] ? (v.itens_os[0].quantidade * v.itens_os[0].preco_unitario) : 0;
        let rotuloPeca = v.itens_os && v.itens_os[0] && v.itens_os[0].produtos ? ` [Peça: ${v.itens_os[0].produtos.nome}]` : "";

        return `<tr>
            <td class="p-4 text-gray-500 text-xs font-semibold">${dataF}</td>
            <td class="p-4 font-medium text-gray-900">${v.clientes ? v.clientes.nome : 'Avulso'}</td>
            <td class="p-4 text-xs font-medium text-gray-700"><span class="font-bold text-slate-900">${v.defeito_relatado}</span><span class="text-gray-400 text-[11px] block">${rotuloPeca}</span></td>
            <td class="p-4 font-bold text-green-700">R$ ${(v.valor_mao_de_obra + pecTotal).toFixed(2)}</td>
            <td class="p-4 text-center space-x-2">
                <button onclick="imprimirRecibo(${v.id})" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded text-xs border border-emerald-200 cursor-pointer">🖨️ Cupom</button>
                <button onclick="deletarVendaBalcao(${v.id})" class="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2 py-1 rounded text-xs border border-red-200 cursor-pointer">🗑️ Excluir</button>
            </td>
        </tr>`;
    }).join('');

    // 2. Renderiza Quadro Técnico com Botão Excluir OS
    const corpoOS = document.getElementById('tabela-ordens-corpo');
    corpoOS.innerHTML = apenasOS.map(o => {
        const d = o.created_at ? new Date(o.created_at) : new Date();
        const dataF = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        let corStatus = "bg-yellow-100 text-yellow-800";
        if (o.status === 'Concluido' || o.status === 'Concluído') corStatus = "bg-blue-100 text-blue-800";
        if (o.status === 'Aguardando Peça') corStatus = "bg-red-100 text-red-800";
        if (o.status === 'Em Andamento') corStatus = "bg-purple-100 text-purple-800";

        return `<tr>
            <td class="p-4 text-gray-500 text-xs font-semibold">${dataF}</td>
            <td class="p-4 font-medium text-gray-900">${o.clientes ? o.clientes.nome : 'Avulso'}</td>
            <td class="p-4">
                <div class="flex flex-col gap-1">
                    <span class="px-2 py-0.5 rounded text-xs font-bold ${corStatus} text-center block w-32 mb-1">${o.status.toUpperCase()}</span>
                    <div class="flex gap-1 text-[10px]">
                        <button onclick="mudarStatusRapido(${o.id}, 'Em Análise')" class="bg-gray-100 hover:bg-yellow-200 px-1 py-0.5 rounded border text-gray-700 cursor-pointer">⏳ Análise</button>
                        <button onclick="mudarStatusRapido(${o.id}, 'Em Andamento')" class="bg-gray-100 hover:bg-purple-200 px-1 py-0.5 rounded border text-gray-700 cursor-pointer">🛠️ Work</button>
                        <button onclick="mudarStatusRapido(${o.id}, 'Aguardando Peça')" class="bg-gray-100 hover:bg-red-200 px-1 py-0.5 rounded border text-gray-700 cursor-pointer">📦 Peça</button>
                        <button onclick="mudarStatusRapido(${o.id}, 'Concluido')" class="bg-gray-100 hover:bg-blue-200 px-1 py-0.5 rounded border text-gray-700 cursor-pointer">✅ Fim</button>
                    </div>
                </div>
            </td>
            <td class="p-4 text-gray-600 text-xs font-semibold">
                <span class="text-gray-900 font-bold block">${o.descricao_equipamento}</span>
                <span class="italic text-gray-500 font-normal">Serviço/Defeito: ${o.defeito_relatado}</span>
            </td>
            <td class="p-4 text-center space-x-2 flex items-center justify-center h-full pt-6">
                <button onclick="imprimirRecibo(${o.id})" class="bg-slate-800 hover:bg-slate-700 text-white font-bold px-2 py-1 rounded text-xs cursor-pointer">🖨️ Ficha A4</button>
                <button onclick="deletarOrdemServico(${o.id}, '${o.descricao_equipamento}')" class="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2 py-1 rounded text-xs border border-red-200 cursor-pointer">🗑️ Excluir</button>
            </td>
        </tr>`;
    }).join('');
}

// ================= FUNÇÕES DE EXCLUSÃO EM CASCATA DE SEGURANÇA =================

async function deletarVendaBalcao(id) {
    if (confirm("Atenção: Deseja estornar e excluir esta venda de balcão definitivamente?\nIsso vai apagar o registro do caixa e devolver os produtos ao estoque.")) {
        
        // 1. Busca se a venda possuía algum produto associado antes de deletar
        const { data: itensVenda } = await banco.from('itens_os').select('produto_id, quantidade').eq('os_id', id);
        
        if (itensVenda && itensVenda.length > 0) {
            for (const item of itensVenda) {
                if (item.produto_id) {
                    // Busca o estoque atual do produto direto no banco
                    const { data: prod } = await banco.from('produtos').select('estoque').eq('id', item.produto_id).single();
                    if (prod) {
                        // Calcula o novo estoque somando de volta a quantidade vendida
                        let novoEstoque = prod.estoque + item.quantidade;
                        await banco.from('produtos').update({ estoque: novoEstoque }).eq('id', item.produto_id);
                    }
                }
            }
        }

        // 2. Remove o vínculo de peças na tabela itens_os
        await banco.from('itens_os').delete().eq('os_id', id);
        
        // 3. Apaga o registro financeiro principal
        const { error } = await banco.from('ordens_servico').delete().eq('id', id);
        
        if (!error) {
            alert("Venda excluída! Dinheiro estornado do caixa e peça(s) devolvida(s) ao estoque com sucesso.");
            carregarSeletoresOperacao(); // Recarrega as tabelas e o Dashboard automaticamente
        } else {
            alert("Erro ao excluir venda: " + error.message);
        }
    }
}

async function deletarOrdemServico(id, equipamento) {
    if (confirm(`Deseja apagar o histórico de monitoramento do equipamento "${equipamento}" do laboratório?`)) {
        // 1. Limpa vínculos em cascata por segurança
        await banco.from('itens_os').delete().eq('os_id', id);
        
        // 2. Apaga a Ordem de Serviço
        const { error } = await banco.from('ordens_servico').delete().eq('id', id);
        
        if (!error) {
            alert("Registro de OS removido do quadro!");
            carregarSeletoresOperacao();
        } else {
            alert("Erro ao excluir OS: " + error.message);
        }
    }
}

    // 2. Renderiza Quadro Técnico
    const corpoOS = document.getElementById('tabela-ordens-corpo');
    corpoOS.innerHTML = apenasOS.map(o => {
        const d = o.created_at ? new Date(o.created_at) : new Date();
        const dataF = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        let corStatus = "bg-yellow-100 text-yellow-800";
        if (o.status === 'Concluido' || o.status === 'Concluído') corStatus = "bg-blue-100 text-blue-800";
        if (o.status === 'Aguardando Peça') corStatus = "bg-red-100 text-red-800";
        if (o.status === 'Em Andamento') corStatus = "bg-purple-100 text-purple-800";

        return `<tr>
            <td class="p-4 text-gray-500 text-xs font-semibold">${dataF}</td>
            <td class="p-4 font-medium text-gray-900">${o.clientes ? o.clientes.nome : 'Avulso'}</td>
            <td class="p-4">
                <div class="flex flex-col gap-1">
                    <span class="px-2 py-0.5 rounded text-xs font-bold ${corStatus} text-center block w-32 mb-1">${o.status.toUpperCase()}</span>
                    <div class="flex gap-1 text-[10px]">
                        <button onclick="mudarStatusRapido(${o.id}, 'Em Análise')" class="bg-gray-100 hover:bg-yellow-200 px-1 py-0.5 rounded border text-gray-700 cursor-pointer">⏳ Análise</button>
                        <button onclick="mudarStatusRapido(${o.id}, 'Em Andamento')" class="bg-gray-100 hover:bg-purple-200 px-1 py-0.5 rounded border text-gray-700 cursor-pointer">🛠️ Work</button>
                        <button onclick="mudarStatusRapido(${o.id}, 'Aguardando Peça')" class="bg-gray-100 hover:bg-red-200 px-1 py-0.5 rounded border text-gray-700 cursor-pointer">📦 Peça</button>
                        <button onclick="mudarStatusRapido(${o.id}, 'Concluido')" class="bg-gray-100 hover:bg-blue-200 px-1 py-0.5 rounded border text-gray-700 cursor-pointer">✅ Fim</button>
                    </div>
                </div>
            </td>
            <td class="p-4 text-gray-600 text-xs font-semibold">
                <span class="text-gray-900 font-bold block">${o.descricao_equipamento}</span>
                <span class="italic text-gray-500 font-normal">Serviço/Defeito: ${o.defeito_relatado}</span>
            </td>
            <td class="p-4 text-center"><button onclick="imprimirRecibo(${o.id})" class="bg-slate-800 hover:bg-slate-700 text-white font-bold px-2 py-1 rounded text-xs cursor-pointer">🖨️ Ficha A4</button></td>
        </tr>`;
    }).join('');

// ================= IMPRESSÕES OTIMIZADAS PARA PC E CELULAR (PDF/WHATSAPP) =================
function imprimirRecibo(id) {
    const os = window.historicoLancamentos.find(item => item.id === id);
    if (!os) return;

    let totalProdutos = os.itens_os ? os.itens_os.reduce((soma, i) => soma + (i.quantidade * i.preco_unitario), 0) : 0;
    let totalGeral = (os.valor_mao_de_obra || 0) + totalProdutos;
    const d = os.created_at ? new Date(os.created_at) : new Date();
    const dataOfe = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    const ehVendaBalcao = os.descricao_equipamento === "Faturamento de Balcão";

    // Cria uma nova aba focada para evitar bloqueios de pop-up em navegadores mobile
    const janelaImpressao = window.open('', '_blank');
    if (!janelaImpressao) {
        alert("Por favor, permita pop-ups para que o documento de impressão possa ser gerado.");
        return;
    }
    
    let htmlDocumento = "";

    if (!ehVendaBalcao) {
        // Ficha de Entrada / Ordem de Serviço A4
        htmlDocumento = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Ordem de Serviço - #${os.id}</title><style>body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333; padding: 15px; max-width: 800px; margin: 0 auto; }.header-table { width: 100%; border-bottom: 2px solid #1e293b; padding-bottom: 15px; margin-bottom: 20px; }.title { font-size: 20px; font-weight: bold; color: #1e293b; text-transform: uppercase; }.info-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; }.section-title { font-size: 13px; font-weight: bold; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 10px; }.grid-2 { display: grid; grid-template-cols: 1fr; gap: 10px; } @media(min-width: 600px) { .grid-2 { grid-template-cols: 1fr 1fr; } }.bold { font-weight: bold; }.termo-legal { font-size: 11px; text-align: justify; color: #475569; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-top: 30px; line-height: 1.4; }.assinaturas { margin-top: 50px; display: flex; justify-content: space-between; gap: 20px; }.linha-assinatura { width: 48%; border-top: 1px solid #333; text-align: center; font-size: 11px; padding-top: 5px; }.btn-print { padding: 12px 24px; background: #1e293b; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 15px; width: 100%; max-width: 300px; } .text-right { text-align: right; } @media print { .no-print { display: none; } body { padding: 0; } }</style></head><body><table class="header-table"><tr><td><span class="title">MSP TECNOLOGIA</span><br><span class="bold">CNPJ: 31.025.921/0001-32</span><br>Irecê - BA | WhatsApp: (74) 99900-8493</td><td class="text-right" style="vertical-align: top;"><span style="font-size: 16px; font-weight: bold; color: #1e293b;">OS Nº #${os.id}</span><br>Status: <span class="bold">${os.status.toUpperCase()}</span><br><span style="font-size: 11px;">${dataOfe}</span></td></tr></table><div class="info-section"><div class="section-title">👥 Dados do Cliente</div><div class="grid-2"><div><span class="bold">Nome:</span> ${os.clientes ? os.clientes.nome : 'Cliente Avulso'}</div><div><span class="bold">WhatsApp:</span> ${os.clientes && os.clientes.telefone ? os.clientes.telefone : '-'}</div></div></div><div class="info-section"><div class="section-title">💻 Detalhamento Técnico</div><p style="margin: 5px 0;"><span class="bold">Aparelho:</span> ${os.descricao_equipamento}</p><p style="margin: 5px 0;"><span class="bold">Serviço Realizado / Defeito:</span> <em>${os.defeito_relatado}</em></p></div><div class="termo-legal"><span class="bold" style="color: #0f172a;">TERMO DE RETIRADA E CLAÚSULA DE ABANDONO (3 MESES):</span><br>O proprietário se compromete a retirar o objeto listado neste documento no prazo máximo de <strong>90 dias (3 meses)</strong>, contados a partir do aviso de conclusão. O transcurso desse prazo sem retirada configurará o <strong>ABANDONO DO EQUIPAMENTO</strong>, autorizando a <strong>MSP TECNOLOGIA</strong> a vender ou descartar o item para cobrir custos de bancada e peças.</div><div class="assinaturas"><div class="linha-assinatura">MSP TECNOLOGIA</div><div class="linha-assinatura">${os.clientes ? os.clientes.nome : 'Assinatura do Cliente'}</div></div><div style="text-align: center; margin-top: 40px;" class="no-print"><button onclick="window.print()" class="btn-print">💾 Gerar PDF / Imprimir</button></div><script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); }</script></body></html>`;
    } else {
        // Cupom Térmico de Venda Balcão (80mm) - Perfeito para Print/PDF no Celular
        htmlDocumento = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Cupom Venda - #${os.id}</title><style>body { font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.4; color: #000; padding: 10px; max-width: 80mm; margin: 0 auto; }.text-center { text-align: center; }.line { border-bottom: 1px dashed #000; margin: 8px 0; }.bold { font-weight: bold; }.table { width: 100%; border-collapse: collapse; margin-top: 5px; }.table th { text-align: left; border-bottom: 1px solid #000; font-size: 11px; }.text-right { text-align: right; } .btn-print { padding: 10px 20px; background: #000; color: #fff; border: none; font-weight: bold; font-size: 13px; width: 100%; margin-top: 20px; cursor: pointer; } @media print { .no-print { display: none; } body { padding: 0; } }</style></head><body><div class="text-center"><span class="bold" style="font-size: 14px;">MSP TECNOLOGIA</span><br>CNPJ: 31.025.921/0001-32<br>WhatsApp: (74) 99900-8493<br><span class="bold">CUPOM DE VENDA</span></div><div class="line"></div><div><span class="bold">Nº Venda:</span> #${os.id}<br><span class="bold">Data:</span> ${dataOfe}<br><span class="bold">Cliente:</span> ${os.clientes ? os.clientes.nome : 'Cliente Avulso'}</div><div class="line"></div><table class="table"><thead><tr><th>DESCRIÇÃO DO ITEM</th><th class="text-right">TOTAL</th></tr></thead><tbody>${os.valor_mao_de_obra > 0 ? `<tr><td>${os.defeito_relatado}</td><td class="text-right">R$ ${os.valor_mao_de_obra.toFixed(2)}</td></tr>` : ''}${os.itens_os && os.itens_os[0] && os.itens_os[0].produtos ? `<tr><td>Pç: ${os.itens_os[0].produtos.nome} (x${os.itens_os[0].quantidade})</td><td class="text-right">R$ ${totalProdutos.toFixed(2)}</td></tr>` : ''}</tbody></table><div class="line"></div><div class="text-right" style="font-size: 13px;"><span class="bold">TOTAL GERAL: R$ ${totalGeral.toFixed(2)}</span></div><div class="line"></div><div class="text-center bold" style="margin-top: 15px;">Obrigado pela preferência!</div><div class="no-print"><button onclick="window.print()" class="btn-print">💾 Enviar / Salvar PDF</button></div><script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); }</script></body></html>`;
    }

    janelaImpressao.document.write(htmlDocumento);
    janelaImpressao.document.close();
}

// ================= LÓGICA DO DASHBOARD AVANÇADO (FILTROS DE DATA) =================
async function atualizarContadoresDashboard() {
    try {
        const { count: tc } = await banco.from('clientes').select('*', { count: 'exact', head: true });
        document.getElementById('dash-qtd-clientes').innerText = tc || 0;
        const { count: tp } = await banco.from('produtos').select('*', { count: 'exact', head: true });
        document.getElementById('dash-qtd-produtos').innerText = tp || 0;

        const { data: lancamentos, error: errO } = await banco.from('ordens_servico').select('*, itens_os(quantidade, preco_unitario)');
        if (!errO && lancamentos) {
            const osAtivas = lancamentos.filter(item => item.descricao_equipamento !== "Faturamento de Balcão").length;
            document.getElementById('dash-qtd-os').innerText = osAtivas;

            let faturamentoTotal = 0;
            let faturamentoMensal = 0;
            let faturamentoDiario = 0;

            const agora = new Date();
            const hojeDataStr = agora.toLocaleDateString('pt-BR');
            const mesAtual = agora.getMonth();
            const anoAtual = agora.getFullYear();

            lancamentos.forEach(o => {
                let pecTotal = o.itens_os ? o.itens_os.reduce((s, i) => s + (i.quantidade * i.preco_unitario), 0) : 0;
                let valorRegistro = (o.valor_mao_de_obra || 0) + pecTotal;

                // Acumula no Geral
                faturamentoTotal += valorRegistro;

                // Análise das datas do Supabase (created_at)
                if (o.created_at) {
                    const dataReg = new Date(o.created_at);
                    
                    // Compara se é HOJE
                    if (dataReg.toLocaleDateString('pt-BR') === hojeDataStr) {
                        faturamentoDiario += valorRegistro;
                    }

                    // Compara se é do MÊS ATUAL e ANO ATUAL
                    if (dataReg.getMonth() === mesAtual && dataReg.getFullYear() === anoAtual) {
                        faturamentoMensal += valorRegistro;
                    }
                }
            });

            // Imprime formatado nas caixas
            document.getElementById('dash-faturamento').innerText = `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`;
            document.getElementById('dash-faturamento-mes').innerText = `R$ ${faturamentoMensal.toFixed(2).replace('.', ',')}`;
            document.getElementById('dash-faturamento-dia').innerText = `R$ ${faturamentoDiario.toFixed(2).replace('.', ',')}`;
        }
    } catch (e) {}
}

atualizarContadoresDashboard();
// ================= CONTROLE DE EDIÇÃO DE PRODUTOS =================
function abrirModalEditar(id, nome, preco, estoque) {
    document.getElementById('edit-prod-id').value = id;
    document.getElementById('edit-prod-nome').value = nome;
    document.getElementById('edit-prod-preco').value = preco;
    document.getElementById('edit-prod-estoque').value = estoque;
    document.getElementById('modal-editar-produto').classList.remove('hidden');
}

function fecharModalEditar() {
    document.getElementById('modal-editar-produto').classList.add('hidden');
}

async function salvarEdicaoProduto() {
    const id = document.getElementById('edit-prod-id').value;
    const nome = document.getElementById('edit-prod-nome').value;
    const preco = parseFloat(document.getElementById('edit-prod-preco').value);
    const estoque = parseInt(document.getElementById('edit-prod-estoque').value);

    if (!nome || isNaN(preco) || isNaN(estoque)) { alert("Preencha todos os campos corretamente."); return; }

    const { error } = await banco.from('produtos').update({ nome, preco, estoque }).eq('id', id);

    if (!error) {
        alert("Produto atualizado com sucesso!");
        fecharModalEditar();
        listarProdutos();
        carregarSeletoresOperacao(); // Atualiza os selects de venda de balcão com o novo preço/estoque
    } else {
        alert("Erro ao atualizar produto: " + error.message);
    }
}