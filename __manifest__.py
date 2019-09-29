# -*- coding: utf-8 -*-
{
    'name': 'POS Customer Account',
    'version': '1.0.1',
    'category': 'Point Of Sale',
    'author': 'Rob Harrington',
    'sequence': 10,
    'summary': 'Manage credit/debits to customer accounts',
    'description': "",
    'depends': ['point_of_sale'],
    'data': [
        'data/pos_customer_credit_data.xml',
        'wizard/apply.xml',
        'wizard/bulk_import.xml',
        'views/account_move_views.xml',
        'views/partner_views.xml',
        'views/assets.xml',
        'views/customer_menu_views.xml'
    ],
    'qweb': [
        'static/src/xml/account_templates.xml'
    ],
    'images': [],
    'installable': True,
    'application': False,
    'license': 'LGPL-3'
}
