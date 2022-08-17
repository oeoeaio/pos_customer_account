# -*- coding: utf-8 -*-
{
    'name': 'POS Customer Account',
    'version': '1.0.2',
    'category': 'Point Of Sale',
    'author': 'Rob Harrington',
    'sequence': 10,
    'summary': 'Manage credit/debits to customer accounts',
    'description': "",
    'depends': ['point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'data/pos_customer_credit_data.xml',
        'wizard/apply.xml',
        'wizard/bulk_import.xml',
        'views/account_move_views.xml',
        'views/partner_views.xml',
        'views/customer_menu_views.xml',
        'views/account_reports.xml',
        'views/report_customer_account_balance.xml'
    ],
    'assets': {
        'point_of_sale.assets': [
            'pos_customer_account/static/src/js/models.js',
            'pos_customer_account/static/src/js/Screens/PaymentScreen/CreditButton.js',
            ('after', 'point_of_sale/static/src/css/pos.css', 'pos_customer_account/static/src/css/credit_button.css'),
        ],
        'web.assets_backend': [
            'pos_customer_account/static/src/js/CustomerAccountTransactionsListController.js',
        ],
        'web.assets_qweb': [
            'pos_customer_account/static/src/xml/**/*',
        ],
    },
    'images': [],
    'installable': True,
    'application': False,
    'license': 'LGPL-3'
}
