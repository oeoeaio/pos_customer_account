odoo.define('pos_customer_account.AccountBalance', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useState } = owl.hooks;
    const { useEffect } = require("@web/core/utils/hooks");
    const { posbus } = require('point_of_sale.utils');

    class AccountBalance extends PosComponent {
        constructor() {
            super(...arguments);

            this.order = this.env.pos.get_order();
            this.client = this.env.pos.get_client();

            this.state = useState({
              credit: 0,
            });

            useEffect(this.refresh.bind(this), () => [])
        }
        refresh() {
          let balance = this.client.account_balance;
          let tendered = this.order.account_payment_total();

          this.el.parentElement.classList.toggle('credit', tendered == 0 && balance > 0);
          this.state.credit = balance - tendered;
        }
        mounted() {
          posbus.on('account-balance-updated', this, this.refresh);
        }
        willUnmount() {
          posbus.off('account-balance-updated', this);
        }
    }

    AccountBalance.template = 'AccountBalance';

    Registries.Component.add(AccountBalance);

    return AccountBalance;
});
