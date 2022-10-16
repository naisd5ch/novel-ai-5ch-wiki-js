//@ts-check
//'nanj_grid_input'classがついているseesaaのtableに機能追加

function nanj_dubug(data)
{
    const container = document.createElement('span');
    container.textContent = `${JSON.stringify(data, undefined, '\t')}`;
    container.append(document.createElement('br'));
    document.body.prepend(container);
}

/**
 * @enum {number}
 * @readonly
 */
ConvertPromptType = {
    WebUI: 0,
    NovelAI: 1,
};

class ConvertPrompt{
    /**
     * @typedef {Object} PromptElem
     * @property {string} text
     * @property {number} power
     */

    /**
     * @param {string} srcPrompt
     * @param {number} index
     * @return {[PromptElem, number]}
     */
    webuiPromptParse(srcPrompt, index)
    {
        let dstPrompt = '';
        let power = 1.0;

        //空白の読み飛ばし
        while(index < srcPrompt.length && srcPrompt[index] === ' ')
        {
            index++;
        }

        //強度を取る(数値指定がある場合は上書きされる)
        while(index < srcPrompt.length && (srcPrompt[index] === '(' || srcPrompt[index] === '['))
        {
            if(srcPrompt[index] === '(')
            {
                power *= 1.1;
            }
            if(srcPrompt[index] === '[')
            {
                power /= 1.1;
            }
            index++;
        }

        //記号が来るまで中身を追加していく
        while(index < srcPrompt.length &&
            srcPrompt[index] !== '[' && srcPrompt[index] !== ']' &&
            srcPrompt[index] !== '(' && srcPrompt[index] !== ')' &&
            srcPrompt[index] !== ':'
            )
        {
            //記号でなければ中身のプロンプトとする
            dstPrompt += srcPrompt[index];
            index++;
        }

        //コロンなら強度を読んで上書き
        if(index < srcPrompt.length && srcPrompt[index] === ':')
        {
            index++; //コロンの次に行く

            let powerText = '';
            while(index < srcPrompt.length && /^[\d.]$/.test(srcPrompt[index]))
            {
                powerText += srcPrompt[index];
                index++;
            }
            power = parseFloat(powerText);
        }

        //最後に閉じる記号を読み飛ばす
        while(index < srcPrompt.length && (srcPrompt[index] === ')' || srcPrompt[index] === ']' ||
            srcPrompt[index] === ' ' || srcPrompt[index] === ','))
        {
            index++;
        }

        return [{text: dstPrompt, power: power}, index];
    }

    /**
     * @param {string} srcPrompt
     * @param {number} index
     * @return {[PromptElem, number]}
     */
    naiPromptParse(srcPrompt, index)
    {
        let dstPrompt = '';
        let power = 1.0;

        //空白の読み飛ばし
        while(index < srcPrompt.length && srcPrompt[index] === ' ')
        {
            index++;
        }

        //強度を取る
        while(index < srcPrompt.length && (srcPrompt[index] === '{' || srcPrompt[index] === '['))
        {
            const char = srcPrompt[index];
            index++;
            if(char === ' ')
            {
                continue;
            }
            if(char === '{')
            {
                power *= 1.05;
                continue;
            }
            if(char === '[')
            {
                power /= 1.05;
                continue;
            }

            break;
        }

        //記号が来るまで中身を追加していく
        while(index < srcPrompt.length &&
            srcPrompt[index] !== '{' && srcPrompt[index] !== '}' &&
            srcPrompt[index] !== '[' && srcPrompt[index] !== ']')
        {
            //記号でなければ中身のプロンプトとする
            dstPrompt += srcPrompt[index];

            index++;
        }

        //最後に閉じる記号を読み飛ばす
        while(index < srcPrompt.length && (srcPrompt[index] === '}' || srcPrompt[index] === ']' ||
                srcPrompt[index] === ' ' || srcPrompt[index] === ',')
            )
        {
            index++;
        }

        return [{text: dstPrompt, power: power}, index];
    }


    /**
     * @param {PromptElem} prompt
     * @param {ConvertPromptType} promptType
     */
    elemToText(prompt, promptType)
    {
        let dstPrompt = '';
        if(promptType === ConvertPromptType.WebUI)
        {
            const toEscape = (text) =>{
                return text.replace(/[()\[\]]/g, match=>{
                    return `\\${match}`;
                });
            }
            //1だったらそのまま帰す
            if(prompt.power === 1.0)
            {
                return toEscape(prompt.text);
            }
            const powerText = prompt.power
                .toFixed(5)
                .replace(/0+$/, '')
                .replace(/\.$/, '.0');
            dstPrompt = `(${toEscape(prompt.text)}:${powerText}), `;
        }
        if(promptType === ConvertPromptType.NovelAI)
        {
            //1だったらそのまま帰す
            if(prompt.power === 1.0)
            {
                return prompt.text;
            }

            let powerCount = 0;
            //実際の値を超える最小のカッコの個数を求める
            while(true)
            {
                //長くなりすぎないよう、最大15までにしておく
                if(powerCount > 15)
                {
                    break;
                }

                powerCount++;
                if(prompt.power <= 1.0 && prompt.power > 1.0 / (1.05 ** powerCount))
                {
                    break;
                }else if(prompt.power >= 1.0 && prompt.power < 1.05 ** powerCount)
                {
                    break;
                }
            }

            //超える個数と超えない個数で、実際の値に近くなる方を採用
            if(powerCount > 0 && prompt.power <= 1.0)
            {
                if(Math.abs(prompt.power - 1.0 / (1.05 ** powerCount)) > Math.abs(prompt.power - 1.0 / (1.05 ** (powerCount - 1))))
                {
                    powerCount--;
                }
            }else if(powerCount > 0 && prompt.power >= 1.0)
            {
                if(Math.abs(prompt.power - (1.05 ** powerCount)) > Math.abs(prompt.power - (1.05 ** (powerCount - 1))))
                {
                    powerCount--;
                }
            }

            if(prompt.power > 1.0)
            {
                dstPrompt = `${'{'.repeat(powerCount)}${prompt.text}${'}'.repeat(powerCount)}, `;
            }else{
                dstPrompt = `${'['.repeat(powerCount)}${prompt.text}${']'.repeat(powerCount)}, `;
            }
        }
        return dstPrompt;
    }

    /**
     *
     * @param {string} srcPrompt
     * @param {ConvertPromptType} srcType
     * @param {ConvertPromptType} dstType
     */
    convert(srcPrompt, srcType, dstType){
        let dstPrompt = '';
        let index = 0;
        while(index < srcPrompt.length)
        {
            if(srcType === ConvertPromptType.WebUI)
            {
                const [prompt, newIndex] = this.webuiPromptParse(srcPrompt, index);
                dstPrompt += this.elemToText(prompt, dstType);
                index = newIndex;
            }
            if(srcType === ConvertPromptType.NovelAI)
            {
                const [prompt, newIndex] = this.naiPromptParse(srcPrompt, index);
                dstPrompt += this.elemToText(prompt, dstType);
                index = newIndex;
            }
        }
        return dstPrompt;
    }
}
{
    //プロンプト変換器を配置するdivにこれをつける
    const targetTableClass = "nanj_prompt_convert";

    //変換可能
    const selectOptions = [[ConvertPromptType.NovelAI, 'NovelAI'], [ConvertPromptType.WebUI, 'WebUI']];

    //選択されたときに、他のSelectが選択しているoptionをかぶらないように別のやつに変えておく
    /**
     * @param {HTMLSelectElement} target
     * @param {HTMLSelectElement[]} selectNodes
     */
    const updateSelectPromptType = (target, selectNodes) => {
        for(const node of selectNodes)
        {
            if(node === target)
            {
                continue;
            }
            if(node.value !== target.value)
            {
                continue;
            }

            for(const option of selectOptions)
            {
                if(option[0] === parseInt(target.value))
                {
                    continue;
                }

                node.value = option[0];
            }
        }
    }

    /**
     * @param {HTMLElement} container
     */
    const updateTextArea = (container)=>{
        /** @type {HTMLTextAreaElement} */
        const srcTextArea = container.getElementsByClassName('nanj_convert_src_textarea')[0];
        /** @type {HTMLSelectElement} */
        const srcPromptTypeSelect = container.getElementsByClassName('nanj_src_type_select')[0];
        /** @type {HTMLTextAreaElement} */
        const dstTextArea = container.getElementsByClassName('nanj_convert_dst_textarea')[0];
        /** @type {HTMLSelectElement} */
        const dstPromptTypeSelect = container.getElementsByClassName('nanj_dst_type_select')[0];
        const converter = new ConvertPrompt();
        const prompt = converter.convert(
            srcTextArea.value,
            /** @type {ConvertPromptType} */ parseInt(srcPromptTypeSelect.value),
            /** @type {ConvertPromptType} */ parseInt(dstPromptTypeSelect.value)
        );
        dstTextArea.value = prompt;
    }


    const setupConvertComponent = () => {
        for (const node of document.getElementsByClassName(targetTableClass)) {
            const container = document.createElement('div');
            container.innerHTML = `
<div style="display: flex; align-items: center">
    <div style="display: flex; flex-flow: column; height: 400px; width: 500px">
        <select class="nanj_convert_select nanj_src_type_select"></select>
        <textarea class="nanj_convert_src_textarea" style="height: 100%"></textarea>
    </div>
    <span style="font-size: 30px">▷</span>
    <div style="display: flex; flex-flow: column; height: 400px; width: 500px">
        <select class="nanj_convert_select nanj_dst_type_select"></select>
        <textarea class="nanj_convert_dst_textarea" disabled style="height: 100%"></textarea>
    </div>
</div>
`;
            /** @type {HTMLSelectElement[]} */
            const selectNodes = [];
            for (const selectNode of container.getElementsByClassName('nanj_convert_select')) {
                selectNodes.push(selectNode);
                for (const optionName of selectOptions) {
                    const optionElem = document.createElement('option');
                    optionElem.value = optionName[0];
                    optionElem.text = optionName[1];
                    selectNode.addEventListener('change', event => {
                        if(!(event.target instanceof HTMLSelectElement)){
                            return;
                        }
                        updateSelectPromptType(event.target, selectNodes);
                        updateTextArea(container);
                    });
                    selectNode.append(optionElem);
                }
            }
            updateSelectPromptType(selectNodes[0], selectNodes);

            /** @type {HTMLTextAreaElement} */
            const srcTextArea = container.getElementsByClassName('nanj_convert_src_textarea')[0];
            srcTextArea.addEventListener('input', event => {
                updateTextArea(container);
            });
            node.append(container);
        }
    }

    const onMyLoadEvent = () => {
        setupConvertComponent();
    };

    document.addEventListener("DOMContentLoaded", onMyLoadEvent);
}
{
    /**
     * @readonly
     * @enum {number}
     */
    const ColumnType = {
        Text: 1,
        Prompt: 2,
        Image: 3,
        EditLink: 4,
    };

    //対象のテーブル このクラスがついている
    const targetTableClass = "nanj_prompt_table";

    //'追加'ボタンの識別用クラス名
    const columnPostButtonClass = "nanj_prompt_table_column_post_button";

    //プロンプトのTableのCellに付くクラス名
    const promptTableCellClass = "nanj_prompt_table_cell";

    /**
     * seesaaの記法に引っかからないようにする
     *  @param {string} value
     */
    const encodeColumnValue = (value) => {
        let encodedValue = value.replace(/[\(\[\|]/g, (match) => {
            //'[' '(' '|' はseesaaの記法とぶつかってしまうので、コードポイントでの表示
            return `&#${match.charCodeAt(0)};`;
        });
        return encodedValue;
    };

    /**
     * 編集ページをGetしてformを引っこ抜く
     * @param {string} editPagePath
     */
    const fetchFormNode = async (editPagePath) => {
        const domParser = new DOMParser();
        const textDecoder = new TextDecoder("euc-jp"); //EUC...

        const editPageBuffer = await (await fetch(editPagePath)).arrayBuffer();
        const editPageText = textDecoder.decode(editPageBuffer);
        const editPageDom = domParser.parseFromString(editPageText, "text/html");

        const formNode = /** @type {HTMLFormElement} */ (
            editPageDom.getElementById("wiki-form")
        );
        return formNode;
    };

    /**
     * 入力データをサーバーにpostしてページを更新させる
     * @param {string} editPagePath
     * @param {string[]} columnValues
     */
    const postColumnDataAsync = async (editPagePath, columnValues) => {
        const formNode = await fetchFormNode(editPagePath);
        const textAreaNode = /** @type {HTMLTextAreaElement} */ (
            formNode.querySelector("#content")
        );
        textAreaNode.value += `\n|${columnValues.join("|")}|`;

        //引っこ抜いたformを非表示でbodyに追加して即post
        formNode.style.cssText = "display: none";
        document.body.appendChild(formNode);
        formNode.submit();
    };

    /**
     * @param {ColumnType[]} columnTypes
     */
    const createNanjGridInputElement = (columnTypes) => {
        const node = document.createElement("tr");
        for (const column of columnTypes) {
            const tdElement = document.createElement("td");
            node.append(tdElement);

            let element;
            switch (column) {
                case ColumnType.Image:
                    element = document.createElement("textarea");
                    element.placeholder = "画像リンク"; //TODO アップロード・画像選択機能
                    break;
                case ColumnType.Prompt:
                case ColumnType.Text:
                    element = document.createElement("textarea");
                    break;
                case ColumnType.EditLink:
                    element = document.createElement("button");
                    element.classList.add(columnPostButtonClass);
                    element.innerText = "Add";
                    break;
                default:
                    throw "範囲外";
            }
            tdElement.append(element);
        }

        return node;
    };

    /**
     * カラムのタイプを取得
     * @param {HTMLTableSectionElement} headElement
     */
    const getColumnTypes = (headElement) => {
        if (headElement.length === 0) {
            return undefined;
        }

        /** @type {ColumnType[]} */
        const columns = [];
        for (const node of headElement.rows[0].cells) {
            if (node.textContent?.includes("プロンプト")) {
                columns.push(ColumnType.Prompt);
                continue;
            } else if (node.textContent?.includes("サンプル")) {
                columns.push(ColumnType.Image);
                continue;
            } else if (node.classList.contains("table_edit_link")) {
                columns.push(ColumnType.EditLink);
                continue;
            } else {
                columns.push(ColumnType.Text);
            }
        }

        return columns;
    };

    /**
     *  簡単追加機能を追加
     * @param {HTMLTableElement} tableNode
     * @param {ColumnType[]} columnTypes
     */
    const setupAddHeader = (tableNode, columnTypes) => {
        const editLink = tableNode.tHead
            ?.querySelector(".table_edit_link a")
            ?.getAttribute("href");
        if (!editLink) {
            return;
        }

        const node = createNanjGridInputElement(columnTypes);
        node.addEventListener("click", (event) => {
            if (!(event.target instanceof HTMLElement)) return;

            if (event.target.classList.contains(columnPostButtonClass)) {
                /** @type {string[]} */
                const columnValues = [];
                for (const columnNode of node.querySelectorAll("td")) {
                    const inputNode = columnNode.querySelector("textarea");
                    if (inputNode === null) {
                        continue;
                    }

                    const columnType = columnTypes[columnNode.cellIndex];
                    let value =
                        columnType === ColumnType.Prompt
                            ? encodeColumnValue(inputNode.value)
                            : inputNode.value;
                    value = value.trim();
                    value = value.replace(/\n/g, ""); //改行はすべて消す
                    columnValues.push(value);
                }
                postColumnDataAsync(editLink, columnValues);
            }
        });
        tableNode.tHead?.append(node);
    };

    /**
     * コピーボタンを付けて、プロンプトをスクロールできるようにする
     * @param {HTMLTableElement} tableNode
     * @param {ColumnType[]} columnTypes
     */
    const setupPromptCellNode = (tableNode, columnTypes) => {
        for (const rowNode of tableNode.tBodies[0].rows) {
            for (const cellNode of rowNode.cells) {
                if (columnTypes.length <= cellNode.cellIndex) {
                    continue;
                }
                if (columnTypes[cellNode.cellIndex] !== ColumnType.Prompt) {
                    continue;
                }

                const divNode = document.createElement("div");
                divNode.classList.add(promptTableCellClass);

                const copyButtonNode = document.createElement("button");
                copyButtonNode.textContent = "Copy";

                const promptTextAreaNode = document.createElement("textarea");
                promptTextAreaNode.disabled = true;
                promptTextAreaNode.value = cellNode.innerText;

                divNode.append(copyButtonNode);
                divNode.append(promptTextAreaNode);
                cellNode.innerText = "";
                cellNode.append(divNode);

                copyButtonNode.addEventListener("click", () => {
                    navigator.clipboard.writeText(promptTextAreaNode.value);
                });
            }
        }
    };

    const setupTable = () => {
        const tableNodes = /** @type {HTMLCollectionOf<HTMLTableElement>} */ (
            document.body.getElementsByClassName(targetTableClass)
        );
        for (const tableNode of tableNodes) {
            if (tableNode.tHead === null) {
                continue;
            }

            const columnTypes = getColumnTypes(tableNode.tHead);
            if (columnTypes === undefined) {
                continue;
            }
            setupAddHeader(tableNode, columnTypes);
            //setupPromptCellNode(tableNode, columnTypes);
        }
    };

    const onMyLoadEvent = () => {
        setupTable();
    };

    document.addEventListener("DOMContentLoaded", onMyLoadEvent);
}
