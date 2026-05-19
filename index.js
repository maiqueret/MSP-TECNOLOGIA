// CONFIGURAÇÃO INICIAL DO SUPABASE
const supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

// VARIÁVEL GLOBAL PARA GUARDAR OS DADOS DO USUÁRIO LOGADO
let usuarioLogado = null;

// VERIFICAÇÃO AUTOMÁTICA DE SESSÃO AO CARREGAR A PÁGINA
document.addEventListener("DOMContentLoaded", async () => {
    const formLogin = document.getElementById("form-login");
    if (formLogin) {
        formLogin.addEventListener("submit", executarLogin);
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
        document.getElementById("tela-login").classList.remove("hidden");
        document.getElementById("app-conteudo").classList.add("hidden");
    } else {
        usuarioLogado = session.user;
        liberarAcessoAplicativo();
    }
});

// FUNÇÃO DO OLHINHO PARA EXIBIR/OCULTAR A SENHA
function toggleSenha() {
    const campoSenha = document.getElementById("login-senha");
    if (campoSenha.type === "password") {
        campoSenha.type = "text";
    } else {
        campoSenha.type = "password";
    }
}

// FUNÇÃO PARA EXECUTAR O LOGIN COM CAPTURA REAL DE ERROS
async function executarLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById("login-email").value.trim();
    const senha = document.getElementById("login-senha").value;
    const erroDiv = document.getElementById("login-erro");
    
    erroDiv.classList.add("hidden");
    erroDiv.innerText = "";

    if (!email || !senha) {
        erroDiv.innerText = "🚨 Preencha todos os campos!";
        erroDiv.classList.remove("hidden");
        return;
    }

    // Chamar a autenticação do Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha
    });

    if (error) {
        console.error("Erro completo do Supabase:", error);
        
        // Exibe o erro na caixa vermelha de forma crua para sabermos o que está travando
        if (error.message.includes("Invalid login credentials")) {
            erroDiv.innerText = "❌ E-mail ou senha incorretos!";
        } else {
            erroDiv.innerText = "⚠️ Resposta do Banco: " + error.message;
        }
        erroDiv.classList.remove("hidden");
    } else {
        usuarioLogado = data.user;
        liberarAcessoAplicativo();
    }
}

// FUNÇÃO QUE LIBERA O APP E CARREGA OS DADOS DO BANCO
function liberarAcessoAplicativo() {
    document.getElementById("tela-login").classList.add("hidden");
    document.getElementById("app-conteudo").classList.remove("hidden");
    
    verificarConexao();
    carregarDadosDashboard();
    listarClientes();
    listarProdutos();
    carregarSeletores();
    listarVendas();
    listarOrdens();
}

// FUNÇÃO PARA DESLOGAR DO APP (LOGOFF)
async function executarLogoff() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        alert("Erro ao sair: " + error.message);
    } else {
        usuarioLogado = null;
        window.location.reload();
    }
}

// ==========================================
// FUNÇÕES DE GERENCIAMENTO DE TELAS (ABAS)
// ==========================================
function mudarAba(aba) {
    const telas = ['dashboard', 'clientes', 'produtos', 'vendas', 'ordens'];
    
    telas.forEach(t => {
        const elementoTela = document.getElementById(`tela-${t}`);
        const elementoBtn = document.getElementById(`btn-${t}`);
        
        if (elementoTela) elementoTela.classList.add('hidden');
        if (elementoBtn) {
            elementoBtn.classList.remove('bg-blue-600', 'text-white');
            elementoBtn.classList.add('hover:bg-slate-800', 'hover:text-white');
        }
    });

    const telaAtiva = document.getElementById(`tela-${aba}`);
    const btnAtivo = document.getElementById(`btn-${aba}`);
    
    if (telaAtiva) telaAtiva.classList.remove('hidden');
    if (btnAtivo) {
        btnAtivo.classList.add('bg-blue-600', 'text-white');
        btnAtivo.classList.remove('hover:bg-slate-800', 'hover:text-white');
    }

    const titulos = {
        dashboard: "📊 Dashboard",
        clientes: "👥 Gerenciamento de Clientes",
        produtos: "📦 Estoque de Peças",
        vendas: "🛒 Balcão de Vendas",
        ordens: "📋 Quadro de Ordens de Serviço"
    };
    document.getElementById('titulo-pagina').innerText = titulos[aba] || "Painel";
}

// ==========================================
// OPERAÇÃO DO BANCO DE DADOS (DASHBOARD)
// ==========================================
async function verificarConexao() {
    try {
        const { data, error } = await supabase.from('clientes').select('id').limit(1);
        const status = document.getElementById('status-conexao');
        if (error) throw error;
        status.innerHTML = "✅ Conectado";
        status.className = "text-xs font-medium bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-200";
    } catch (err) {
        const status = document.getElementById('status-conexao');
        status.innerHTML = "❌ Erro de Conexão";
        status.className = "text-xs font-medium bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-200";
    }
}

async function carregarDadosDashboard() {
    try {
        const { count: qtdClientes } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
        const { count: qtdProdutos } = await supabase.from('produtos').select('*', { count: 'exact', head: true });
        const { count: qtdOS } = await supabase.from('ordens_servico').select('*', { count: 'exact', head: true });
        
        document.getElementById('dash-qtd-clientes').innerText = qtdClientes || 0;
        document.getElementById('dash-qtd-produtos').innerText = qtdProdutos || 0;
        document.getElementById('dash-qtd-os').innerText = qtdOS || 0;

        const { data: vendas } = await supabase.from('vendas_balcao').select('total_venda, created_at');
        
        let totalGeral = 0;
        let totalMes = 0;
        let totalHoje = 0;
        
        const hoje = new Date().toISOString().split('T')[0];
        const esteMes = new Date().toISOString().substring(0, 7);

        if (vendas) {
            vendas.forEach(v => {
                const valor = parseFloat(v.total_venda) || 0;
                totalGeral += valor;
                
                if (v.created_at.startsWith(hoje)) totalHoje += valor;
                if (v.created_at.startsWith(esteMes)) totalMes += valor;
            });
        }

        document.getElementById('dash-faturamento').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-faturamento-mes').innerText = `R$ ${totalMes.toFixed(2).replace('.', ',')}`;
        document.getElementById('dash-faturamento-dia').innerText = `R$ ${totalHoje.toFixed(2).replace('.', ',')}`;

    } catch (e) {
        console.error("Erro no dashboard:", e);
    }
}

// ==========================================
// SEÇÃO DE CLIENTES (CADASTRO E LISTA)
// ==========================================
if (document.getElementById('form-cliente')) {
    document.getElementById('form-cliente').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('cli-nome').value;
        const telefone = document.getElementById('cli-telefone').value;

        const { error } = await supabase.from('clientes').insert([{ nome, telefone }]);
        if (error) alert("Erro ao salvar: " + error.message);
        else {
            document.getElementById('form-cliente').reset();
            listarClientes();
            carregarDadosDashboard();
            carregarSeletores();
        }
    });
}

async function listarClientes() {
    const busca = document.getElementById('busca-cliente')?.value.toLowerCase() || "";
    let query = supabase.from('clientes').select('*').order('nome', { ascending: true });
    
    const { data: lista } = await query;
    const corpo = document.getElementById('tabela-clientes-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";

    if (lista) {
        lista.forEach(c => {
            if (c.nome.toLowerCase().includes(busca) || c.telefone.includes(busca)) {
                corpo.innerHTML += `
                    <tr class="hover:bg-gray-50 border-b border-gray-100">
                        <td class="p-3 md:p-4 font-medium text-gray-900">${c.nome}</td>
                        <td class="p-3 md:p-4 text-gray-600">${c.telefone || 'Não informado'}</td>
                        <td class="p-3 md:p-4 text-center">
                            <button onclick="deletarItem('clientes', '${c.id}', listarClientes)" class="text-red-600 hover:text-red-900 font-medium cursor-pointer px-2 py-1 rounded hover:bg-red-50">Excluir</button>
                        </td>
                    </tr>
                `;
            }
        });
    }
}

// ==========================================
// SEÇÃO DE PRODUTOS / PEÇAS
// ==========================================
if (document.getElementById('form-produto')) {
    document.getElementById('form-produto').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('prod-nome').value;
        const preco = parseFloat(document.getElementById('prod-preco').value);
        const estoque = parseInt(document.getElementById('prod-estoque').value);

        const { error } = await supabase.from('produtos').insert([{ nome, preco, estoque }]);
        if (error) alert("Erro ao salvar peça: " + error.message);
        else {
            document.getElementById('form-produto').reset();
            listarProdutos();
            carregarDadosDashboard();
            carregarSeletores();
        }
    });
}

async function listarProdutos() {
    const busca = document.getElementById('busca-produto')?.value.toLowerCase() || "";
    const { data: lista } = await supabase.from('produtos').select('*').order('nome', { ascending: true });
    const corpo = document.getElementById('tabela-produtos-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";

    if (lista) {
        lista.forEach(p => {
            if (p.nome.toLowerCase().includes(busca)) {
                const estoqueAlerta = p.estoque <= 2 ? 'text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100' : 'text-gray-600';
                corpo.innerHTML += `
                    <tr class="hover:bg-gray-50 border-b border-gray-100">
                        <td class="p-3 md:p-4 font-medium text-gray-900">${p.nome}</td>
                        <td class="p-3 md:p-4 font-mono text-gray-700">R$ ${p.preco.toFixed(2).replace('.', ',')}</td>
                        <td class="p-3 md:p-4"><span class="${estoqueAlerta}">${p.estoque} un</span></td>
                        <td class="p-3 md:p-4 text-center space-x-2">
                            <button onclick="abrirModalEditar('${p.id}', '${p.nome}', ${p.preco}, ${p.estoque})" class="text-blue-600 hover:text-blue-900 font-medium cursor-pointer px-2 py-1 rounded hover:bg-blue-50">Editar</button>
                            <button onclick="deletarItem('produtos', '${p.id}', listarProdutos)" class="text-red-600 hover:text-red-900 font-medium cursor-pointer px-2 py-1 rounded hover:bg-red-50">Excluir</button>
                        </td>
                    </tr>
                `;
            }
        });
    }
}

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

    const { error } = await supabase.from('produtos').update({ nome, preco, estoque }).eq('id', id);
    if (error) alert("Erro ao editar: " + error.message);
    else {
        fecharModalEditar();
        listarProdutos();
        carregarDadosDashboard();
        carregarSeletores();
    }
}

// ==========================================
// SEÇÃO DE VENDAS DE BALCÃO
// ==========================================
async function carregarSeletores() {
    const { data: clientes } = await supabase.from('clientes').select('id, nome').order('nome');
    const { data: produtos } = await supabase.from('produtos').select('id, nome, preco, estoque').order('nome');

    const selCliVenda = document.getElementById('vd-cliente');
    const selProdVenda = document.getElementById('vd-produto');
    const selCliOS = document.getElementById('os-cliente');

    if (selCliVenda && clientes) {
        selCliVenda.innerHTML = `<option value="">-- Selecione o Cliente --</option>`;
        clientes.forEach(c => selCliVenda.innerHTML += `<option value="${c.id}">${c.nome}</option>`);
    }
    if (selCliOS && clientes) {
        selCliOS.innerHTML = `<option value="">-- Selecione o Cliente --</option>`;
        clientes.forEach(c => selCliOS.innerHTML += `<option value="${c.id}">${c.nome}</option>`);
    }
    if (selProdVenda && produtos) {
        selProdVenda.innerHTML = `<option value="">-- Nenhuma peça aplicada (Apenas Mão de Obra) --</option>`;
        produtos.forEach(p => {
            const desabilitado = p.estoque <= 0 ? 'disabled' : '';
            const textoEstoque = p.estoque <= 0 ? '(ESGOTADO)' : `(Estoque: ${p.estoque})`;
            selProdVenda.innerHTML += `<option value="${p.id}" data-preco="${p.preco}" data-estoque="${p.estoque}" ${desabilitado}>${p.nome} - R$ ${p.preco.toFixed(2)} ${textoEstoque}</option>`;
        });
    }
}

async function executarVendaBalcao() {
    const clienteId = document.getElementById('vd-cliente').value;
    const produtoId = document.getElementById('vd-produto').value || null;
    const qtd = parseInt(document.getElementById('vd-qtd').value) || 1;
    const valorServico = parseFloat(document.getElementById('vd-valor-servico').value) || 0;
    const descricaoServico = document.getElementById('vd-descricao-servico').value;

    if (!clienteId) {
        alert("Escolha o cliente para fechar a venda!");
        return;
    }

    let valorPecaTotal = 0;
    if (produtoId) {
        const seletor = document.getElementById('vd-produto');
        const opcao = seletor.options[seletor.selectedIndex];
        const precoUn = parseFloat(opcao.getAttribute('data-preco'));
        const estoqueAtual = parseInt(opcao.getAttribute('data-estoque'));

        if (qtd > estoqueAtual) {
            alert(`Quantidade insuficiente no estoque! Você tem apenas ${estoqueAtual} unidades.`);
            return;
        }
        valorPecaTotal = precoUn * qtd;
    }

    const totalVenda = valorPecaTotal + valorServico;

    const { error: erroVenda } = await supabase.from('vendas_balcao').insert([{
        cliente_id: clienteId,
        produto_id: produtoId,
        quantidade_peca: produtoId ? qtd : null,
        valor_servico: valorServico,
        descricao_servico: descricaoServico,
        total_venda: totalVenda
    }]);

    if (erroVenda) {
        alert("Erro no checkout da venda: " + erroVenda.message);
        return;
    }

    if (produtoId) {
        const seletor = document.getElementById('vd-produto');
        const opcao = seletor.options[seletor.selectedIndex];
        const estoqueAtual = parseInt(opcao.getAttribute('data-estoque'));
        await supabase.from('produtos').update({ estoque: estoqueAtual - qtd }).eq('id', produtoId);
    }

    document.getElementById('vd-produto').value = "";
    document.getElementById('vd-qtd').value = "1";
    document.getElementById('vd-valor-servico').value = "0.00";
    document.getElementById('vd-descricao-servico').value = "";

    listarVendas();
    listarProdutos();
    carregarDadosDashboard();
    carregarSeletores();
    alert("Venda registrada e estoque atualizado!");
}

async function listarVendas() {
    const { data: vendas } = await supabase.from('vendas_balcao').select(`
        id, created_at, quantidade_peca, valor_servico, descricao_servico, total_venda,
        clientes(nome),
        produtos(nome)
    `).order('created_at', { ascending: false });

    const corpo = document.getElementById('tabela-vendas-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";

    if (vendas) {
        vendas.forEach(v => {
            const dataFmt = new Date(v.created_at).toLocaleString('pt-BR');
            const pecaTexto = v.produtos ? `📦 ${v.produtos.nome} (x${v.quantidade_peca})` : '⚠️ Nenhuma peça aplicada';
            const servicoTexto = v.descricao_servico ? `<br><span class="text-slate-500">🔧 ${v.descricao_servico}</span>` : '';
            
            corpo.innerHTML += `
                <tr class="hover:bg-gray-50 border-b border-gray-100">
                    <td class="p-3 md:p-4 font-mono text-gray-600">${dataFmt}</td>
                    <td class="p-3 md:p-4 font-semibold text-gray-900">${v.clientes?.nome || 'Excluído'}</td>
                    <td class="p-3 md:p-4 text-xs text-gray-700">${pecaTexto} ${servicoTexto}</td>
                    <td class="p-3 md:p-4 font-bold text-emerald-600 font-mono">R$ ${v.total_venda.toFixed(2).replace('.', ',')}</td>
                    <td class="p-3 md:p-4 text-center">
                        <button onclick="deletarVenda('${v.id}')" class="text-red-500 hover:text-red-800 cursor-pointer">Estornar</button>
                    </td>
                </tr>
            `;
        });
    }
}

async function deletarVenda(id) {
    if (!confirm("Deseja estornar essa venda? O valor será removido do caixa. (Nota: Peças não retornam automaticamente ao estoque nesta versão)")) return;
    const { error } = await supabase.from('vendas_balcao').delete().eq('id', id);
    if (error) alert(error.message);
    else {
        listarVendas();
        carregarDadosDashboard();
    }
}

// ==========================================
// SEÇÃO DE ORDENS DE SERVIÇO (QUADRO TÉCNICO)
// ==========================================
async function finalizarOperacao() {
    const clienteId = document.getElementById('os-cliente').value;
    const status = document.getElementById('os-status').value;
    const equipamento = document.getElementById('os-equipamento').value;
    const descricao = document.getElementById('os-descricao').value;

    if (!clienteId || !equipamento || !descricao) {
        alert("Preencha todos os campos do chamado técnico!");
        return;
    }

    const { error } = await supabase.from('ordens_servico').insert([{
        cliente_id: clienteId,
        status,
        equipamento,
        descricao_defeito: descricao
    }]);

    if (error) alert("Erro ao registrar OS: " + error.message);
    else {
        document.getElementById('os-equipamento').value = "";
        document.getElementById('os-descricao').value = "";
        listarOrdens();
        carregarDadosDashboard();
    }
}

async function listarOrdens() {
    const { data: ordens } = await supabase.from('ordens_servico').select(`
        id, status, equipamento, descricao_defeito, created_at,
        clientes(nome)
    `).order('created_at', { ascending: false });

    const corpo = document.getElementById('tabela-ordens-corpo');
    if (!corpo) return;
    corpo.innerHTML = "";

    if (ordens) {
        ordens.forEach(o => {
            const dataFmt = new Date(o.created_at).toLocaleDateString('pt-BR');
            let badgeColor = "bg-gray-100 text-gray-800";
            if (o.status === "Em Andamento") badgeColor = "bg-amber-100 text-amber-800";
            if (o.status === "Aguardando Peça") badgeColor = "bg-purple-100 text-purple-800";
            if (o.status === "Concluido") badgeColor = "bg-green-100 text-green-800";

            corpo.innerHTML += `
                <tr class="hover:bg-gray-50 border-b border-gray-100">
                    <td class="p-3 md:p-4 font-mono text-gray-500">OS-${o.id.substring(0,4).toUpperCase()}<br><span class="text-[10px]">${dataFmt}</span></td>
                    <td class="p-3 md:p-4 font-bold text-gray-900">${o.clientes?.nome || 'Excluído'}</td>
                    <td class="p-3 md:p-4">
                        <select onchange="atualizarStatusOS('${o.id}', this.value)" class="text-xs font-semibold px-2 py-1 rounded-md border border-gray-200 ${badgeColor} focus:outline-none cursor-pointer">
                            <option value="Em Análise" ${o.status === 'Em Análise' ? 'selected' : ''}>⏳ Em Análise</option>
                            <option value="Em Andamento" ${o.status === 'Em Andamento' ? 'selected' : ''}>🛠️ Na Bancada</option>
                            <option value="Aguardando Peça" ${o.status === 'Aguardando Peça' ? 'selected' : ''}>📦 Sem Peça</option>
                            <option value="Concluido" ${o.status === 'Concluido' ? 'selected' : ''}>✅ Concluído</option>
                        </select>
                    </td>
                    <td class="p-3 md:p-4 text-xs"><span class="font-semibold text-slate-800">${o.equipamento}</span><br><span class="text-gray-500">${o.descricao_defeito}</span></td>
                    <td class="p-3 md:p-4 text-center">
                        <button onclick="deletarItem('ordens_servico', '${o.id}', listarOrdens)" class="text-red-500 hover:text-red-800 cursor-pointer">Remover</button>
                    </td>
                </tr>
            `;
        });
    }
}

async function actualizarStatusOS(id, novoStatus) {
    const { error } = await supabase.from('ordens_servico').update({ status: novoStatus }).eq('id', id);
    if (error) alert(error.message);
    else {
        listarOrdens();
        carregarDadosDashboard();
    }
}

// ==========================================
// UTILIÁRIOS GERAIS (EXCLUSÃO)
// ==========================================
async function deletarItem(tabela, id, callbackSucesso) {
    if (!confirm("Atenção técnico! Deseja realmente excluir este registro permanentemente do banco de dados?")) return;
    const { error } = await supabase.from(tabela).delete().eq('id', id);
    if (error) alert("Erro ao deletar: " + error.message);
    else {
        callbackSucesso();
        carregarDadosDashboard();
        carregarSeletores();
    }
}
