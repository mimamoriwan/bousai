import React from 'react';

const TermsPage = () => {
    return (
        <div className="card" style={{ margin: 'var(--spacing-md)', paddingBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>利用規約</h2>
            <div style={{ lineHeight: '1.6', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    本利用規約（以下「本規約」）は、「みまもりWAN」（以下「本サービス」）の利用条件を定めるものです。本サービスをご利用になるすべての方（以下「ユーザー」）は、本規約に同意したものとみなされます。
                </p>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>第1条（適用）</h3>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    本規約は、ユーザーと本サービス運営者間の、本サービスの利用に関わる一切の関係に適用されるものとします。
                </p>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>第2条（禁止事項）</h3>
                <p style={{ marginBottom: 'var(--spacing-sm)' }}>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
                <ul style={{ paddingLeft: '20px', marginBottom: 'var(--spacing-md)' }}>
                    <li>法令または公序良俗に違反する行為</li>
                    <li>犯罪行為に関連する行為</li>
                    <li>本サービスの内容等、本サービスに含まれる著作権、商標権ほか知的財産権を侵害する行為</li>
                    <li>運営者、他のユーザー、またはその他第三者のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
                    <li>個人を特定できる情報（表札、車のナンバープレート、個人の顔等）が明確に写り込んだ写真の投稿</li>
                    <li>虚偽の情報、または第三者を誹謗中傷する情報の投稿</li>
                    <li>その他、運営者が不適切と判断する行為</li>
                </ul>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>第3条（コンテンツの取り扱い）</h3>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    ユーザーが本サービスに投稿した写真や情報等（以下「投稿コンテンツ」）の著作権は、原則として投稿したユーザーに帰属します。ただし、ユーザーは運営者に対して、本サービスの提供・改善・プロモーション等の目的において、投稿コンテンツを無償で非独占的に利用（複製、公開、送信、頒布、譲渡、貸与、翻訳、翻案等）する権利を許諾するものとします。
                </p>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>第4条（本サービスの提供の停止等）</h3>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    運営者は、システムの保守点検、通信回線の障害、地震・火災等の不可抗力による場合、その他運営者が本サービスの提供が困難と判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
                </p>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>第5条（利用制限および登録抹消）</h3>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    運営者は、ユーザーが本規約のいずれかの条項に違反した場合、事前の通知なく、投稿コンテンツの削除、本サービスの利用の制限、またはユーザーとしての登録を抹消することができるものとします。
                </p>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>第6条（免責事項）</h3>
                <p style={{ marginBottom: 'var(--spacing-sm)' }}>
                    運営者は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます）がないことを明示的にも黙示的にも保証しておりません。
                </p>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    本サービス上で共有される情報はユーザーからの投稿に基づくものであり、その正確性や安全性を完全に保証するものではありません。情報の利用によって生じたあらゆる損害やトラブル（ユーザー同士、または第三者との間）について、運営者は一切の責任を負いません。
                </p>

                <h3 style={{ marginTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-sm)' }}>第7条（利用規約の変更）</h3>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    運営者は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。なお、本規約の変更後、本サービスの利用を開始した場合には、当該ユーザーは変更後の規約に同意したものとみなします。
                </p>

                <p style={{ marginTop: 'var(--spacing-xl)', textAlign: 'right', fontSize: '0.8rem', color: 'var(--color-text-sub)' }}>
                    制定日: 2026年2月24日
                </p>
            </div>
        </div>
    );
};

export default TermsPage;
